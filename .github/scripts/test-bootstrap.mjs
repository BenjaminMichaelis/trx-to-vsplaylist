import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const scenario = process.env.BOOTSTRAP_SCENARIO;
assert.ok(['install', 'reuse'].includes(scenario));
const executable = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet';
const toolNames = process.platform === 'win32'
  ? ['trx-to-vsplaylist.exe', 'trx-to-vsplaylist.cmd', 'trx-to-vsplaylist.bat']
  : ['trx-to-vsplaylist'];
const installRoot = path.join(process.env.RUNNER_TEMP, 'dotnet');
const toolPath = path.join(process.env.RUNNER_TEMP, '.dotnet-tools-trx-to-vsplaylist');

function findOnPath(name) {
  return process.env.PATH.split(path.delimiter)
    .map(directory => path.join(directory, name))
    .find(candidate => existsSync(candidate));
}

function runDotnet(host, ...args) {
  return execFileSync(host, args, { encoding: 'utf8' }).trim();
}

function verifyPlaylist(file) {
  const contents = readFileSync(file, 'utf8');
  assert.match(contents, /FailedTest/u);
  assert.doesNotMatch(contents, /PassedTest/u);
}

switch (process.argv[2]) {
  case 'prepare': {
    assert.ok(!toolNames.some(findOnPath), 'the converter must not be preinstalled');
    assert.ok(!existsSync(installRoot), 'the SDK install destination must be empty');
    assert.ok(!existsSync(toolPath), 'the tool install destination must be empty');
    const host = findOnPath(executable);
    assert.ok(host, 'expected a hosted-runner dotnet host for the fixture');
    const systemRoot = path.dirname(realpathSync(host));
    let expectedRoot = systemRoot;
    if (scenario === 'install') {
      const isolatedRoot = path.join(process.env.RUNNER_TEMP, 'bootstrap host with spaces');
      mkdirSync(isolatedRoot);
      copyFileSync(path.join(systemRoot, executable), path.join(isolatedRoot, executable));
      cpSync(path.join(systemRoot, 'host'), path.join(isolatedRoot, 'host'), {
        recursive: true,
      });
      assert.equal(runDotnet(path.join(isolatedRoot, executable), '--list-sdks'), '');
      appendFileSync(process.env.GITHUB_PATH, `${isolatedRoot}\n`);
      expectedRoot = installRoot;
    } else {
      const sdks = runDotnet(host, '--list-sdks');
      assert.match(sdks, /^10\.0\.\d+ /mu);
      assert.match(sdks, /^11\.0\.\d+ /mu);
      assert.match(runDotnet(host, '--version'), /^11\.0\./u);
    }
    appendFileSync(
      process.env.GITHUB_ENV,
      `BOOTSTRAP_EXPECTED_ROOT=${expectedRoot}\nDOTNET_ROOT=${path.join(process.env.RUNNER_TEMP, 'stale-root')}\n`
    );
    break;
  }
  case 'verify': {
    const expectedRoot = process.env.BOOTSTRAP_EXPECTED_ROOT;
    assert.equal(process.env.DOTNET_ROOT, expectedRoot);
    assert.equal(process.env[`DOTNET_ROOT_${os.arch().toUpperCase()}`], expectedRoot);
    assert.equal(existsSync(installRoot), scenario === 'install');
    assert.ok(
      toolNames.some(name => existsSync(path.join(toolPath, name))),
      'the action must install its own converter'
    );
    assert.match(
      runDotnet(path.join(expectedRoot, executable), '--list-sdks'),
      /^10\.0\.\d+ /mu
    );
    if (scenario === 'reuse') {
      assert.match(runDotnet(findOnPath(executable), '--version'), /^11\.0\./u);
    }
    assert.ok(process.env.PLAYLIST_PATH, 'playlist-path must not be empty');
    assert.ok(process.env.ARTIFACT_DIR, 'artifact-dir must not be empty');
    verifyPlaylist(process.env.PLAYLIST_PATH);
    break;
  }
  case 'artifact':
    verifyPlaylist(path.join('downloaded-playlists', 'comprehensive.playlist'));
    break;
  case 'cleanup':
    assert.ok(!existsSync(toolPath), 'the bundled post hook must remove the tool');
    break;
  default:
    throw new Error('Expected prepare, verify, artifact, or cleanup');
}
