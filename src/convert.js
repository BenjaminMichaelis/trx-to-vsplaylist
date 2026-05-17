import * as exec from '@actions/exec';
import * as core from '@actions/core';
import fs from 'fs';
import path from 'path';

function listFiles(dir, recursive) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) results.push(...listFiles(fullPath, true));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

export function globToRegex(absForwardPattern) {
  const convertPart = (part) => {
    let regex = '';
    for (let i = 0; i < part.length; i++) {
      const char = part[i];
      if (char === '*') {
        regex += '[^/]*';
      } else if (char === '?') {
        regex += '[^/]';
      } else if (char === '[') {
        const end = part.indexOf(']', i + 1);
        if (end > i + 1) {
          let classContent = part.slice(i + 1, end);
          if (classContent[0] === '!') {
            classContent = `^${classContent.slice(1)}`;
          }
          classContent = classContent
            .replace(/\\/g, '\\\\')
            .replace(/]/g, '\\]');
          regex += `[${classContent}]`;
          i = end;
        } else {
          regex += '\\[';
        }
      } else {
        regex += /[.+^${}()|\\]/.test(char) ? `\\${char}` : char;
      }
    }
    return regex;
  };

  // Split on ** first, then handle * and ? per segment to avoid control chars
  const escapedParts = absForwardPattern.split('**').map(convertPart);
  // Re-join: when both sides carry a slash around **, use (?:/.*)? so zero
  // intermediate directories are allowed (e.g. **/foo matches foo at root).
  let regexBody = escapedParts[0];
  for (let i = 1; i < escapedParts.length; i++) {
    const next = escapedParts[i];
    if (regexBody.endsWith('/') && next.startsWith('/')) {
      regexBody = regexBody.slice(0, -1) + '(?:/.*)?' + next;
    } else {
      regexBody += '.*' + next;
    }
  }
  return new RegExp(
    `^${regexBody}$`,
    process.platform === 'win32' ? 'i' : ''
  );
}

// Cross-platform glob using fs.readdirSync + regex matching.
// @actions/glob has a bug on Windows where path.join produces backslash paths
// that don't match minimatch patterns which use forward slashes.
async function globPattern(pattern) {
  const absPattern = path.resolve(pattern).split(path.sep).join('/');
  const segments = absPattern.split('/');
  const firstGlobSegmentIndex = segments.findIndex((segment) =>
    /[*?[]/.test(segment)
  );
  const rootSegments =
    firstGlobSegmentIndex === -1
      ? segments.slice(0, -1)
      : segments.slice(0, firstGlobSegmentIndex);
  let baseDir = rootSegments.join('/');
  if (baseDir === '') baseDir = '/';
  if (/^[A-Za-z]:$/.test(baseDir)) baseDir += '/';
  const hasGlobInDirectorySegment = segments
    .slice(0, -1)
    .some((segment) => /[*?[]/.test(segment));
  const recursive = absPattern.includes('**') || hasGlobInDirectorySegment;
  const regex = globToRegex(absPattern);
  return listFiles(baseDir, recursive)
    .filter((f) => regex.test(f.split(path.sep).join('/')))
    .sort();
}

/**
 * Resolve TRX files from a pattern, preserving backward compatibility
 * with space-separated literal paths and space-separated glob patterns.
 */
export async function resolveTrxFiles(pattern) {
  const hasGlobChars = /[*?[]/.test(pattern);

  if (!hasGlobChars) {
    // Literal path(s) — check single path first, then try space-splitting
    if (fs.existsSync(pattern)) return [path.resolve(pattern)];
    const paths = pattern.split(/\s+/).filter(Boolean);
    for (const p of paths) {
      if (!fs.existsSync(p)) throw new Error(`TRX file not found: ${p}`);
    }
    return paths.map((p) => path.resolve(p));
  }

  // Try the full pattern as-is first (handles paths with spaces like './Test Results/*.trx')
  let files = await globPattern(pattern);

  // Legacy fallback: space-separated patterns (e.g. '**/*.trx **/other.trx')
  if (files.length === 0 && /\s/.test(pattern)) {
    for (const p of pattern.split(/\s+/).filter(Boolean)) {
      files = files.concat(await globPattern(p));
    }
  }

  return files;
}

export async function convert() {
  const trxPattern = core.getInput('trx-file-path', { required: true });
  const outputDirectory = core.getInput('output-directory');
  const outcomes = core.getInput('test-outcomes');
  const skipEmpty = core.getBooleanInput('skip-empty');
  const separate = core.getBooleanInput('separate');

  // 1. Resolve TRX files
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
    core.info(
      `Using separate mode: creating individual playlists in ${artifactDir}`
    );
  } else {
    const basename = path.basename(trxFiles[0], '.trx');
    outputFile =
      trxFiles.length > 1
        ? path.join(artifactDir, 'merged.playlist')
        : path.join(artifactDir, `${basename}.playlist`);
    args.push('--output', outputFile);
    core.info(`Using merge mode: creating combined playlist at ${outputFile}`);
  }

  if (skipEmpty) args.push('--skip-empty');

  if (outcomes) {
    for (const o of outcomes.split(',')) {
      const trimmed = o.trim();
      if (trimmed) args.push('--outcome', trimmed);
    }
  }

  // 4. Run marker for freshness detection
  const runMarker = path.join(
    process.env.RUNNER_TEMP,
    `trx-run-marker-${process.pid}`
  );
  fs.writeFileSync(runMarker, '');
  const markerTime = fs.statSync(runMarker).mtimeMs;

  // 5. Execute CLI
  core.debug(`Running: trx-to-vsplaylist ${args.join(' ')}`);
  await exec.exec('trx-to-vsplaylist', args);

  // 6. Set outputs using freshness check
  let freshPlaylists = [];

  if (separate) {
    freshPlaylists = fs
      .readdirSync(artifactDir)
      .filter((f) => f.endsWith('.playlist'))
      .map((f) => path.join(artifactDir, f))
      .filter((f) => fs.statSync(f).mtimeMs > markerTime)
      .sort();

    if (freshPlaylists.length === 0 && !skipEmpty) {
      throw new Error('No playlist files were created');
    }
    if (freshPlaylists.length > 0) {
      core.info(`Successfully created ${freshPlaylists.length} playlist file(s)`);
    } else {
      core.info(
        'Info: No playlist files were created (likely due to --skip-empty and no matching tests)'
      );
    }
    core.setOutput('playlist-paths', freshPlaylists.join(':'));
  } else {
    if (
      outputFile &&
      fs.existsSync(outputFile) &&
      fs.statSync(outputFile).mtimeMs > markerTime
    ) {
      core.info(`Successfully created playlist file: ${outputFile}`);
      core.setOutput('playlist-path', outputFile);
      freshPlaylists = [outputFile];
    } else if (!skipEmpty) {
      throw new Error(`Playlist file was not created at: ${outputFile}`);
    } else {
      core.info(
        'Info: Playlist file was not created (likely due to --skip-empty and no matching tests)'
      );
    }
  }

  fs.unlinkSync(runMarker);
  core.setOutput('artifact-dir', artifactDir);
  return { artifactDir, freshPlaylists };
}
