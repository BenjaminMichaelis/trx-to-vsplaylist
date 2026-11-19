import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as actualExec from '@actions/exec';
import * as actualIo from '@actions/io';

let dotnetPath: string;
let sdkOutput: string;
let sdkExitCode: number;
let installerFails: boolean;
let tempDir: string;
const messages: string[] = [];
const addedPaths: string[] = [];
const exportedVariables = new Map<string, string>();
const commands: string[][] = [];

mock.module('@actions/core', {
  namedExports: {
    getInput: () => '10.0',
    info: (message: string) => messages.push(message),
    addPath: (value: string) => addedPaths.push(value),
    exportVariable: (name: string, value: string) =>
      exportedVariables.set(name, value),
  },
});
mock.module('@actions/io', {
  namedExports: {
    which: async (name: string, required: boolean) => {
      if (name === 'dotnet') return dotnetPath;
      return actualIo.which(name, required);
    },
  },
});
mock.module('@actions/exec', {
  namedExports: {
    getExecOutput: async (_command: string, args: string[]) => {
      commands.push(args);
      assert.ok(dotnetPath, 'must not execute dotnet when it is missing');
      return {
        exitCode: sdkExitCode,
        stdout: args[0] === '--list-sdks' ? sdkOutput : '11.0.100\n',
        stderr: sdkExitCode ? 'SDK discovery failed' : '',
      };
    },
    exec: actualExec.exec,
  },
});
mock.module('@actions/tool-cache', {
  namedExports: {
    downloadTool: async (_url: string, destination?: string) => {
      const scriptPath =
        destination ?? path.join(tempDir, 'installer with spaces.sh');
      writeFileSync(
        scriptPath,
        os.platform() === 'win32'
          ? `param([string]$Channel, [string]$InstallDir)\nexit ${installerFails ? 1 : 0}\n`
          : `#!/bin/sh\nexit ${installerFails ? 1 : 0}\n`
      );
      return scriptPath;
    },
  },
});

const { ensureDotnet } = await import('../src/setup-dotnet.js');

describe('SDK bootstrap', () => {
  let originalEnvironment: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnvironment = { ...process.env };
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'bootstrap with spaces '));
    process.env.RUNNER_TEMP = tempDir;
    process.env.DOTNET_ROOT = path.join(tempDir, 'stale-root');
    dotnetPath = process.execPath;
    sdkOutput = '11.0.100 [sdk]\n';
    sdkExitCode = 0;
    installerFails = false;
    messages.length = 0;
    addedPaths.length = 0;
    exportedVariables.clear();
    commands.length = 0;
  });

  afterEach(() => {
    process.env = originalEnvironment;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('executes the real installer process with paths containing spaces', async () => {
    await ensureDotnet();
    assert.deepEqual(addedPaths, [path.join(tempDir, 'dotnet')]);
    assert.equal(
      exportedVariables.get('DOTNET_ROOT'),
      path.join(tempDir, 'dotnet')
    );
    assert.equal(
      exportedVariables.get(`DOTNET_ROOT_${os.arch().toUpperCase()}`),
      path.join(tempDir, 'dotnet')
    );
    assert.ok(messages.some(message => message.includes('SDK installed')));
  });

  it('reuses an installed matching SDK even when a newer SDK is selected', async () => {
    sdkOutput = '10.0.100 [sdk]\r\n11.0.100 [sdk]\r\n';
    await ensureDotnet();
    assert.deepEqual(commands, [['--list-sdks']]);
    assert.deepEqual(addedPaths, []);
    assert.equal(
      exportedVariables.get('DOTNET_ROOT'),
      path.dirname(realpathSync(process.execPath))
    );
    assert.ok(messages.some(message => message.includes('already available')));
  });

  it('installs when dotnet is not on PATH without trying to execute it', async () => {
    dotnetPath = '';
    await ensureDotnet();
    assert.deepEqual(commands, []);
    assert.ok(messages.some(message => message.includes('SDK installed')));
  });

  it('installs when the host has no SDKs', async () => {
    sdkOutput = '';
    await ensureDotnet();
    assert.ok(messages.some(message => message.includes('SDK installed')));
  });

  it('does not reuse a preview SDK for a stable channel', async () => {
    sdkOutput = '10.0.100-preview.1 [sdk]\n';
    await ensureDotnet();
    assert.ok(messages.some(message => message.includes('SDK installed')));
  });

  it('does not silently treat an SDK discovery failure as a missing SDK', async () => {
    sdkExitCode = 1;
    await assert.rejects(ensureDotnet(), /SDK discovery failed/u);
    assert.deepEqual(addedPaths, []);
  });

  it('surfaces installer failures without configuring a successful installation', async () => {
    installerFails = true;
    await assert.rejects(ensureDotnet(), /exit code 1/u);
    assert.deepEqual(addedPaths, []);
    assert.equal(exportedVariables.size, 0);
  });
});
