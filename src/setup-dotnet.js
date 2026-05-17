import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import * as io from '@actions/io';
import path from 'path';
import os from 'os';
import { chmodSync, realpathSync } from 'fs';

export function isInstalledVersionCompatible(installedVersion, channel) {
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

export function normalizeDotnetChannel(channel) {
  return channel.trim().replace(/\.x$/i, '');
}

async function configureDotnetEnvironment(installDir) {
  const dotnetRoot = installDir || process.env.DOTNET_ROOT || (await getDotnetRoot());

  core.exportVariable('DOTNET_ROOT', dotnetRoot);
  process.env.DOTNET_ROOT = dotnetRoot;

  // On macOS arm64, also set DOTNET_ROOT_ARM64 so apphost-based tools can find runtime
  if (os.platform() === 'darwin' && os.arch() === 'arm64') {
    core.exportVariable('DOTNET_ROOT_ARM64', dotnetRoot);
    process.env.DOTNET_ROOT_ARM64 = dotnetRoot;
  }
}

async function getDotnetRoot() {
  const dotnetPath = await io.which('dotnet', true);
  const realDotnetPath = realpathSync(dotnetPath);
  return path.dirname(realDotnetPath);
}

export async function ensureDotnet() {
  const channel = core.getInput('dotnet-version') || '10.0';
  const installChannel = normalizeDotnetChannel(channel);

  // Check if dotnet is already on PATH and matches the requested channel
  const dotnetVersion = await exec.getExecOutput('dotnet', ['--version'], {
    silent: true,
    ignoreReturnCode: true,
  });
  if (dotnetVersion.exitCode === 0) {
    const installedVersion = dotnetVersion.stdout.trim();
    if (isInstalledVersionCompatible(installedVersion, channel)) {
      await configureDotnetEnvironment();
      core.info(
        `.NET SDK already available (${installedVersion}) for requested channel ${channel}`
      );
      return;
    }
    core.info(
      `.NET SDK ${installedVersion} does not match requested channel ${channel}, installing...`
    );
  } else {
    core.info('.NET SDK not found, installing...');
  }

  const installDir = path.join(process.env.RUNNER_TEMP, 'dotnet');

  if (os.platform() === 'win32') {
    // Download and run dotnet-install.ps1
    const scriptPath = await tc.downloadTool(
      'https://dot.net/v1/dotnet-install.ps1'
    );
    const pwsh =
      (await io.which('pwsh', false)) || (await io.which('powershell', true));
    await exec.exec(pwsh, [
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
    await exec.exec(scriptPath, [
      '--channel',
      installChannel,
      '--install-dir',
      installDir,
    ]);
  }

  core.addPath(installDir);
  await configureDotnetEnvironment(installDir);

  core.info(`.NET SDK installed to ${installDir}`);
}
