# Plan: Convert Composite Action → JavaScript Action

## 1. Overall Architecture

### Files to Create
```
package.json              # Dependencies + build scripts
rollup.config.js          # Bundler config (two entry points: main + post)
src/
  index.js                # Entry point for main → calls run()
  post.js                 # Entry point for post → calls cleanup()
  main.js                 # Core logic: setup dotnet, install tool, convert, upload
  cleanup.js              # Post-job cleanup (remove tool install dir)
  setup-dotnet.js         # Ensure .NET SDK is available (install if missing)
  install-tool.js         # Install trx-to-vsplaylist dotnet tool
  convert.js              # Glob resolution, build CLI args, run trx-to-vsplaylist, set outputs
  upload-artifact.js      # Upload playlist files via @actions/artifact
dist/
  index.js                # Bundled main (committed to repo)
  post.js                 # Bundled post (committed to repo)
```

### Files to Modify
- **`action.yml`** — Change `runs.using` from `composite` to `node24`, add `main`/`post`, add `dotnet-version` input
- **`.gitignore`** — Ensure `node_modules/` excluded, `dist/` tracked (remove `dist/` from ignore)
- **`.github/workflows/update-trx-to-vsplaylist.yml`** — No changes needed (sed patterns match new YAML)

### Files to Delete
- **`.github/actions/setup-trx-tool/`** — Dead prototype (empty `src/` and `dist/`, committed node_modules)

---

## 2. New `action.yml`

```yaml
name: 'TRX to VS Playlist Converter'
description: >
  Convert TRX test result files to Visual Studio Test playlist files.
branding:
  icon: 'play'
  color: 'blue'

inputs:
  trx-file-path:
    description: >
      Path or glob pattern to the TRX file(s) to convert.
    required: true
  output-directory:
    description: >
      Directory to write the output playlist file(s) to (optional).
    required: false
  test-outcomes:
    description: >
      Test outcomes to include (comma-separated). Default: Failed
    required: false
    default: 'Failed'
  artifact-name:
    description: >
      Name for the uploaded artifact.
    required: false
  skip-empty:
    description: >
      Skip writing out empty playlist files. Default: true
    required: false
    default: 'true'
  separate:
    description: >
      Create separate playlist files instead of merging. Default: false
    required: false
    default: 'false'
  tool-version:
    description: >
      Version of trx-to-vsplaylist .NET tool to install.
    required: false
    default: '1.3.0'
  dotnet-version:
    description: >
      .NET SDK channel to install if dotnet is not already on PATH (e.g. '10.0').
      Skipped when dotnet is already available.
    required: false
    default: '10.0'

outputs:
  playlist-path:
    description: 'Path to the generated playlist file (merge mode)'
  playlist-paths:
    description: 'Colon-separated list of playlist file paths (separate mode)'
  artifact-dir:
    description: 'Directory containing the generated playlist file(s)'

runs:
  using: 'node24'
  main: 'dist/index.js'
  post: 'dist/post.js'
```

**Key changes from composite:**
- `runs.using: 'node24'` — matches the official `actions/javascript-action` template
- `main:` and `post:` entry points replace the `steps:` array
- Outputs set directly via `core.setOutput()` (no step expression references)
- New `dotnet-version` input replaces the hardcoded `10.x` in `setup-dotnet` step
- All existing inputs preserved with identical names, types, defaults

---

## 3. .NET Setup: Use `dotnet-install` scripts (same as `actions/setup-dotnet`)

**Decision**: Auto-install .NET via Microsoft's official `dotnet-install` scripts if not already on PATH. This is the same well-documented approach that `actions/setup-dotnet` uses internally — it bundles `externals/install-dotnet.sh` and `externals/install-dotnet.ps1` from `https://dot.net/v1/`.

**Implementation** (`src/setup-dotnet.js`):
```js
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import * as io from '@actions/io';
import path from 'path';
import os from 'os';
import { chmodSync } from 'fs';

export async function ensureDotnet() {
  // Check if dotnet is already on PATH
  try {
    await exec.exec('dotnet', ['--version'], { silent: true });
    core.info('.NET SDK already available');
    return;
  } catch {
    core.info('.NET SDK not found, installing...');
  }

  const channel = core.getInput('dotnet-version') || '10.0';
  const installDir = path.join(process.env.RUNNER_TEMP, 'dotnet');

  if (os.platform() === 'win32') {
    // Download and run dotnet-install.ps1
    const scriptPath = await tc.downloadTool('https://dot.net/v1/dotnet-install.ps1');
    const pwsh = await io.which('pwsh', false) || await io.which('powershell', true);
    await exec.exec(`"${pwsh}"`, [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Unrestricted',
      '-Command', `& '${scriptPath}' -Channel ${channel} -InstallDir '${installDir}'`
    ]);
  } else {
    // Download and run dotnet-install.sh
    const scriptPath = await tc.downloadTool('https://dot.net/v1/dotnet-install.sh');
    chmodSync(scriptPath, '755');
    await exec.exec(scriptPath, ['--channel', channel, '--install-dir', installDir]);
  }

  core.addPath(installDir);
  core.exportVariable('DOTNET_ROOT', installDir);
  core.info(`.NET SDK installed to ${installDir}`);
}
```

**Why this approach:**
- `dotnet-install.sh` / `.ps1` are the official Microsoft-documented scripts for CI/CD
- `@actions/tool-cache.downloadTool()` is the GitHub toolkit's standard way to fetch external tools
- Cross-platform (Linux/macOS/Windows) with platform-specific script selection
- Only runs when dotnet isn't already on PATH — if the user already ran `setup-dotnet`, it's a no-op
- Fully backward compatible — no user-facing breaking change

---

## 4. `main.js` Responsibilities

Orchestrates four phases in sequence:

### Phase 1: Ensure .NET SDK
Call `ensureDotnet()` — installs .NET if not on PATH (see Section 3).

### Phase 2: Install trx-to-vsplaylist dotnet tool
```js
const toolVersion = core.getInput('tool-version');
const toolPath = path.join(process.env.RUNNER_TEMP, '.dotnet-tools-trx-to-vsplaylist');
try {
  await exec.exec('dotnet', ['tool', 'install', '--tool-path', toolPath,
    'trx-to-vsplaylist', '--version', toolVersion,
    '--source', 'https://api.nuget.org/v3/index.json']);
} catch {
  await exec.exec('dotnet', ['tool', 'update', '--tool-path', toolPath,
    'trx-to-vsplaylist', '--version', toolVersion,
    '--source', 'https://api.nuget.org/v3/index.json']);
}
core.addPath(toolPath);
core.saveState('toolPath', toolPath);
```

### Phase 3: Convert TRX to Playlist
Port bash logic to JS using a custom file-system glob resolver + `@actions/exec` (see Section 5).

### Phase 4: Upload Artifact
Use `@actions/artifact` `DefaultArtifactClient` (see Section 6).

---

## 5. Conversion Logic: Port to JavaScript

**Decision**: Port to JavaScript (not shell out to bash).

**Rationale:**
1. GitHub docs recommend JS actions be pure JavaScript
2. `resolveTrxFiles()` + `globToRegex()` handle the bash glob behavior (including `**`) across platforms
3. The bash logic is ~80 lines of file matching + arg building — straightforward to port
4. `path.join()`, `path.basename()`, `path.dirname()` handle cross-platform paths
5. Testable with `node --test` by covering `globToRegex()`/`resolveTrxFiles()` and CLI arg assembly
6. No bash dependency — works on Windows runners without Git Bash quirks

### Ported Logic (`src/convert.js`)

```js
import * as exec from '@actions/exec';
import * as core from '@actions/core';
import fs from 'fs';
import path from 'path';

export async function convert() {
  const trxPattern = core.getInput('trx-file-path', { required: true });
  const outputDirectory = core.getInput('output-directory');
  const outcomes = core.getInput('test-outcomes');
  const skipEmpty = core.getBooleanInput('skip-empty');
  const separate = core.getBooleanInput('separate');

  // 1. Resolve TRX files using resolveTrxFiles (handles compat)
  const trxFiles = await resolveTrxFiles(trxPattern);
  if (trxFiles.length === 0) {
    throw new Error(`No TRX files found matching pattern: ${trxPattern}`);
  }
  core.info(`Found ${trxFiles.length} TRX file(s): ${trxFiles.join(', ')}`);

  // 2. Determine artifact directory
  const artifactDir = outputDirectory || path.dirname(trxFiles[0]);
  if (outputDirectory) fs.mkdirSync(artifactDir, { recursive: true });

  // 3. Build CLI args
  const args = ['convert', ...trxFiles];
  let outputFile;
  if (separate) {
    args.push('--output', artifactDir, '--separate');
  } else {
    const basename = path.basename(trxFiles[0], '.trx');
    outputFile = trxFiles.length > 1
      ? path.join(artifactDir, 'merged.playlist')
      : path.join(artifactDir, `${basename}.playlist`);
    args.push('--output', outputFile);
  }
  if (skipEmpty) args.push('--skip-empty');
  if (outcomes) {
    for (const o of outcomes.split(',')) {
      const trimmed = o.trim();
      if (trimmed) args.push('--outcome', trimmed);
    }
  }

  // 4. Run marker for freshness detection (replaces bash RUN_MARKER + -nt)
  const runMarker = path.join(process.env.RUNNER_TEMP, `trx-run-marker-${process.pid}`);
  fs.writeFileSync(runMarker, '');
  const markerTime = fs.statSync(runMarker).mtimeMs;

  // 5. Execute CLI
  core.debug(`Running: trx-to-vsplaylist ${args.join(' ')}`);
  await exec.exec('trx-to-vsplaylist', args);

  // 6. Set outputs using freshness check
  if (separate) {
    const playlists = fs.readdirSync(artifactDir)
      .filter(f => f.endsWith('.playlist'))
      .map(f => path.join(artifactDir, f))
      .filter(f => fs.statSync(f).mtimeMs > markerTime)
      .sort();
    if (playlists.length === 0 && !skipEmpty) {
      throw new Error('No playlist files were created');
    }
    if (playlists.length > 0) {
      core.info(`Successfully created ${playlists.length} playlist file(s)`);
    }
    core.setOutput('playlist-paths', playlists.join(':'));
  } else {
    if (outputFile && fs.existsSync(outputFile) && fs.statSync(outputFile).mtimeMs > markerTime) {
      core.info(`Successfully created playlist file: ${outputFile}`);
      core.setOutput('playlist-path', outputFile);
    } else if (!skipEmpty) {
      throw new Error(`Playlist file was not created at: ${outputFile}`);
    }
  }

  fs.unlinkSync(runMarker);
  core.setOutput('artifact-dir', artifactDir);
  return artifactDir;
}
```

### Glob Backward Compatibility (`resolveTrxFiles`)

The bash script handles space-separated literal paths and space-separated globs. We keep compatibility by trying the full pattern first, then falling back to space-split legacy glob parts when needed:

```js
async function resolveTrxFiles(pattern) {
  const hasGlobChars = /[*?\[]/.test(pattern);
  if (!hasGlobChars) {
    // Literal path(s) — check single path first, then try space-splitting
    if (fs.existsSync(pattern)) return [path.resolve(pattern)];
    const paths = pattern.split(/\s+/).filter(Boolean);
    for (const p of paths) {
      if (!fs.existsSync(p)) throw new Error(`TRX file not found: ${p}`);
    }
    return paths.map(p => path.resolve(p));
  }
  // Try full pattern first (supports paths with spaces)
  let files = await globPattern(pattern);

  // Legacy fallback: split on spaces when no files matched
  if (files.length === 0 && /\s/.test(pattern)) {
    for (const p of pattern.split(/\s+/).filter(Boolean)) {
      files = files.concat(await globPattern(p));
    }
  }
  return files;
}
```

This preserves backward compat with `'./TestResults/sample.trx ./TestResults/additional.trx'` (the test workflow uses this pattern).

---

## 6. Upload Artifact: Use `@actions/artifact` Package

**Decision**: Use `@actions/artifact` `DefaultArtifactClient` directly.

**Rationale**: JS actions **cannot** call other actions (fundamental GitHub Actions limitation). `@actions/artifact` is the same library that powers `actions/upload-artifact@v6`. It's the GitHub-provided, well-documented path.

```js
import { DefaultArtifactClient } from '@actions/artifact';
import * as glob from '@actions/glob';
import * as core from '@actions/core';

export async function uploadPlaylistArtifact(artifactDir) {
  const artifactName = core.getInput('artifact-name')
    || `test-results-${process.env.GITHUB_RUN_ID}`;

  const globber = await glob.create(`${artifactDir}/*.playlist`);
  const files = await globber.glob();

  if (files.length === 0) {
    core.warning('No playlist files found to upload');
    return;  // Matches composite action's if-no-files-found: 'warn'
  }

  const client = new DefaultArtifactClient();
  const { id, size } = await client.uploadArtifact(artifactName, files, artifactDir);
  core.info(`Uploaded artifact '${artifactName}' (id: ${id}, size: ${size})`);
}
```

---

## 7. `post.js`: Cleanup via `core.getState()`

**Decision**: Use `core.saveState()` / `core.getState()` — the GitHub-documented mechanism for passing state between `main` and `post` lifecycle hooks.

```js
// src/cleanup.js
import * as core from '@actions/core';
import fs from 'fs';

export function cleanup() {
  const toolPath = core.getState('toolPath');
  if (toolPath && fs.existsSync(toolPath)) {
    fs.rmSync(toolPath, { recursive: true, force: true });
    core.info(`Cleaned up tool directory: ${toolPath}`);
  }
}
```

```js
// src/post.js (entry point)
import { cleanup } from './cleanup.js';
cleanup();
```

`core.saveState` serializes via `STATE_*` environment variables, which the runner passes from main → post. This is the documented pattern from `@actions/core` README ("Action state" section).

---

## 8. Inputs/Outputs Mapping

| action.yml Input | JS Code |
|-----------------|---------|
| `trx-file-path` | `core.getInput('trx-file-path', { required: true })` |
| `output-directory` | `core.getInput('output-directory')` |
| `test-outcomes` | `core.getInput('test-outcomes')` |
| `artifact-name` | `core.getInput('artifact-name')` |
| `skip-empty` | `core.getBooleanInput('skip-empty')` |
| `separate` | `core.getBooleanInput('separate')` |
| `tool-version` | `core.getInput('tool-version')` |
| `dotnet-version` | `core.getInput('dotnet-version')` |

| action.yml Output | JS Code |
|-------------------|---------|
| `playlist-path` | `core.setOutput('playlist-path', filePath)` |
| `playlist-paths` | `core.setOutput('playlist-paths', colonSeparatedPaths)` |
| `artifact-dir` | `core.setOutput('artifact-dir', dir)` |

All existing consumer inputs/outputs are unchanged. The new `dotnet-version` input is optional with a default.

---

## 9. Build System: Rollup with Two Entry Points

**Decision**: Follow the official `actions/javascript-action` template's Rollup pattern, extended to two entry points.

```js
// rollup.config.js
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';

const shared = {
  output: { esModule: true, format: 'es', sourcemap: true },
  plugins: [commonjs(), nodeResolve({ preferBuiltins: true }), json()],
};

export default [
  {
    ...shared,
    input: 'src/index.js',
    output: { ...shared.output, file: 'dist/index.js' },
  },
  {
    ...shared,
    input: 'src/post.js',
    output: { ...shared.output, file: 'dist/post.js' },
  },
];
```

`@rollup/plugin-json` is needed because `@actions/artifact` imports JSON files internally. This is a standard Rollup plugin from the same `@rollup` org.

---

## 10. `package.json`

```json
{
  "name": "trx-to-vsplaylist-action",
  "version": "2.0.0",
  "description": "Convert TRX test result files to VS Test playlist files",
  "type": "module",
  "private": true,
  "scripts": {
    "package": "npx rimraf ./dist && npx rollup --config rollup.config.js",
    "build": "npm run package",
    "lint": "eslint src/ __tests__/ --max-warnings 0",
    "test": "node --test",
    "all": "npm run lint && npm run test && npm run package"
  },
  "dependencies": {
    "@actions/core": "^3.0.0",
    "@actions/exec": "^1.1.1",
    "@actions/glob": "^0.5.0",
    "@actions/artifact": "^2.3.0",
    "@actions/io": "^1.1.3",
    "@actions/tool-cache": "^2.0.1"
  },
  "devDependencies": {
    "@rollup/plugin-commonjs": "^29.0.0",
    "@rollup/plugin-json": "^6.1.0",
    "@rollup/plugin-node-resolve": "^16.0.3",
    "eslint": "^9.0.0",
    "rollup": "^4.57.1",
    "rimraf": "^6.0.0"
  },
  "engines": { "node": ">=24" }
}
```

All dependencies are from GitHub's official `@actions/*` toolkit:
- `@actions/core` — inputs, outputs, state, logging, path manipulation
- `@actions/exec` — run `dotnet` and `trx-to-vsplaylist` CLI commands
- `@actions/glob` — resolve TRX file glob patterns
- `@actions/artifact` — upload playlist files (replaces `actions/upload-artifact@v6` step)
- `@actions/io` — `which()` for finding executables, directory utilities
- `@actions/tool-cache` — download `dotnet-install` scripts (replaces `actions/setup-dotnet@v5` step)

---

## 11. Version-Bump Workflow (`update-trx-to-vsplaylist.yml`)

**Decision**: No changes needed. The `sed` patterns still match:

```bash
# Extract: looks for tool-version block before outputs:
sed -n '/^  tool-version:/,/^outputs:/p' action.yml | grep -oP "default:\s*'\K[0-9.]+"
# Update: replaces default value in tool-version block
sed -i "/^  tool-version:/,/^outputs:/ s/default: '[0-9][0-9.]*'/default: '$LATEST'/" action.yml
```

The new action.yml preserves `tool-version:` before `outputs:` with the same YAML indentation. The new `dotnet-version` input sits between `tool-version` and `outputs`, but the sed range `/^  tool-version:/,/^outputs:/` will correctly match through both inputs and stop at `outputs:`.

**Verified**: The sed range matches from `tool-version:` to `outputs:`, and the first `default: 'X.Y.Z'` in that range is `tool-version`'s default. The `dotnet-version` default `'10.0'` won't match the `[0-9][0-9.]*` pattern (it has only one dot group), so the replacement is safe.

---

## 12. Backward Compatibility — Full Preservation

| Aspect | Status | Notes |
|--------|--------|-------|
| Input names/defaults | ✅ Identical | All 7 existing inputs unchanged |
| Output names/formats | ✅ Identical | `playlist-path`, `playlist-paths` (colon-sep), `artifact-dir` |
| Glob patterns | ✅ Compat | Pre-process space-separated paths for backward compat |
| Artifact upload | ✅ Equivalent | `@actions/artifact` with warn-on-empty matches `if-no-files-found: warn` |
| Default artifact name | ✅ Same | `test-results-{run_id}` |
| Error messages | ✅ Same format | `core.setFailed()` produces `::error::` annotations |
| Skip-empty behavior | ✅ Same | Freshness marker logic ported identically |
| .NET setup | ✅ Auto-install | Uses `dotnet-install` scripts via `@actions/tool-cache` — no user change needed |

**No breaking changes.** This can ship as a v2 minor/patch release.

---

## 13. Implementation Order

1. Initialize Node project: `npm init -y`, install all dependencies
2. Replace `action.yml` with JS action metadata
3. Create `src/index.js` — entry point, calls `run()` from `main.js`
4. Create `src/main.js` — orchestrator (ensureDotnet → installTool → convert → upload)
5. Create `src/setup-dotnet.js` — .NET install via `dotnet-install` scripts + `@actions/tool-cache`
6. Create `src/install-tool.js` — dotnet tool install/update
7. Create `src/convert.js` — port bash conversion logic to JS
8. Create `src/upload-artifact.js` — artifact upload via `@actions/artifact`
9. Create `src/post.js` — entry point, calls `cleanup()` from `cleanup.js`
10. Create `src/cleanup.js` — remove tool install dir
11. Create `rollup.config.js` — two-bundle config
12. Run `npm run package` → generates `dist/index.js` and `dist/post.js`
13. Update `.gitignore` — ensure `node_modules/` excluded, `dist/` committed
14. Update `README.md` — document new `dotnet-version` input
15. Delete `.github/actions/setup-trx-tool/` — remove dead code
16. Test: push to branch, verify CI passes with existing test workflow

---

## 14. Gotchas and Edge Cases

1. **Glob compatibility**: `resolveTrxFiles()` first evaluates the full pattern, then falls back to legacy space-split glob parts for backward compatibility.
2. **`@actions/artifact` v2 + GITHUB_TOKEN**: Token is automatically available in Actions environment. No config needed.
3. **Bundle size**: `dist/index.js` ≈ 1-2MB (artifact + HTTP deps). Normal for JS actions. `dist/post.js` ≈ 50KB.
4. **`@rollup/plugin-json`**: Required because `@actions/artifact` imports JSON files. Without it, Rollup fails on `.json` imports.
5. **Windows paths**: Use `path.join()` throughout. Never hardcode `/`.
6. **Run marker freshness**: `fs.statSync().mtimeMs` replaces bash `-nt` operator. Same logic, same behavior.
7. **Separate mode discovery**: `fs.readdirSync()` + `.endsWith('.playlist')` + mtime filter replaces bash `find -newer -print0`.
8. **`dist/` committed to repo**: GitHub Actions require bundled dist in the repo. `.gitignore` must NOT ignore `dist/`.
9. **Node 24**: Official template uses `node24`. All GitHub-hosted runners support it.
10. **State persistence**: `core.saveState`/`core.getState` uses `STATE_*` env vars. Only works within same action invocation (main → post).
