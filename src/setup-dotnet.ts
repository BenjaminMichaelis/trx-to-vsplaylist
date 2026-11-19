import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import * as io from '@actions/io';
import { randomUUID } from 'node:crypto';
import path from 'path';
import os from 'os';
import { chmodSync, realpathSync } from 'fs';

export function isInstalledVersionCompatible(
  installedVersion: string,
  channel: string
): boolean {
  const normalized = normalizeDotnetChannel(channel);
  if (!normalized) return true;
  if (normalized.includes('.')) {
    return (
      installedVersion === normalized ||
      installedVersion.startsWith(`${normalized}.`)
    );
  }
  return installedVersion.split('.')[0] === normalized;
}

export function normalizeDotnetChannel(channel: string): string {
  const trimmed = channel.trim();
  if (/^\d+\.x$/iu.test(trimmed)) {
    return trimmed.replace(/\.x$/iu, '.0');
  }
  return trimmed.replace(/\.x$/iu, '');
}

export function getDotnetInstallScriptPath(
  runnerTemp = process.env.RUNNER_TEMP
): string {
  return path.join(runnerTemp ?? os.tmpdir(), `${randomUUID()}.ps1`);
}

function configureDotnetEnvironment(dotnetRoot: string): void {
  core.exportVariable('DOTNET_ROOT', dotnetRoot);
  core.exportVariable(`DOTNET_ROOT_${os.arch().toUpperCase()}`, dotnetRoot);
}

export async function ensureDotnet(): Promise<void> {
  const channel = core.getInput('dotnet-version') || '10.0';
  const installChannel = normalizeDotnetChannel(channel);

  const dotnetPath = await io.which('dotnet', false);
  if (dotnetPath) {
    const installedSdks = await exec.getExecOutput(
      `"${dotnetPath}"`,
      ['--list-sdks'],
      { silent: true, ignoreReturnCode: true }
    );
    if (installedSdks.exitCode !== 0) {
      throw new Error(
        `Unable to discover installed .NET SDKs: ${installedSdks.stderr || installedSdks.stdout}`
      );
    }
    const installedVersion = installedSdks.stdout
      .split(/\r?\n/u)
      .map(line => /^(\d+\.\d+\.\d+)\s+\[/u.exec(line)?.[1])
      .find(version => version && isInstalledVersionCompatible(version, channel));
    if (installedVersion) {
      configureDotnetEnvironment(path.dirname(realpathSync(dotnetPath)));
      core.info(
        `.NET SDK already available (${installedVersion}) for requested channel ${channel}`
      );
      return;
    }
    core.info(
      `No installed .NET SDK matches requested channel ${channel}, installing...`
    );
  } else {
    core.info('.NET SDK not found, installing...');
  }

  const tempRoot = process.env.RUNNER_TEMP ?? os.tmpdir();
  const installDir = path.join(tempRoot, 'dotnet');

  if (os.platform() === 'win32') {
    // Download and run dotnet-install.ps1
    const scriptPath = await tc.downloadTool(
      'https://dot.net/v1/dotnet-install.ps1',
      getDotnetInstallScriptPath(tempRoot)
    );
    const pwsh =
      (await io.which('pwsh', false)) || (await io.which('powershell', true));
    await exec.exec(`"${pwsh}"`, [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Unrestricted',
      '-File',
      scriptPath,
      '-Channel',
      installChannel,
      '-InstallDir',
      installDir,
    ]);
  } else {
    // Download and run dotnet-install.sh
    const scriptPath = await tc.downloadTool(
      'https://dot.net/v1/dotnet-install.sh'
    );
    chmodSync(scriptPath, '755');
    await exec.exec(`"${scriptPath}"`, [
      '--channel',
      installChannel,
      '--install-dir',
      installDir,
    ]);
  }

  core.addPath(installDir);
  configureDotnetEnvironment(installDir);

  core.info(`.NET SDK installed to ${installDir}`);
}
