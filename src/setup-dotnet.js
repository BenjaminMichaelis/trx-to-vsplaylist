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
    const scriptPath = await tc.downloadTool(
      'https://dot.net/v1/dotnet-install.ps1'
    );
    const pwsh =
      (await io.which('pwsh', false)) || (await io.which('powershell', true));
    await exec.exec(`"${pwsh}"`, [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Unrestricted',
      '-Command',
      `& '${scriptPath}' -Channel ${channel} -InstallDir '${installDir}'`,
    ]);
  } else {
    // Download and run dotnet-install.sh
    const scriptPath = await tc.downloadTool(
      'https://dot.net/v1/dotnet-install.sh'
    );
    chmodSync(scriptPath, '755');
    await exec.exec(scriptPath, [
      '--channel',
      channel,
      '--install-dir',
      installDir,
    ]);
  }

  core.addPath(installDir);
  core.exportVariable('DOTNET_ROOT', installDir);
  core.info(`.NET SDK installed to ${installDir}`);
}
