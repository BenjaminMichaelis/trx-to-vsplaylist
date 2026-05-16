import * as core from '@actions/core';
import * as exec from '@actions/exec';
import path from 'path';

export async function installTool() {
  const toolVersion = core.getInput('tool-version');
  const toolPath = path.join(
    process.env.RUNNER_TEMP,
    '.dotnet-tools-trx-to-vsplaylist'
  );

  // Save state before install so post-step can clean up even if install fails
  core.saveState('toolPath', toolPath);

  try {
    await exec.exec('dotnet', [
      'tool',
      'install',
      '--tool-path',
      toolPath,
      'trx-to-vsplaylist',
      '--version',
      toolVersion,
      '--source',
      'https://api.nuget.org/v3/index.json',
    ]);
  } catch {
    await exec.exec('dotnet', [
      'tool',
      'update',
      '--tool-path',
      toolPath,
      'trx-to-vsplaylist',
      '--version',
      toolVersion,
      '--source',
      'https://api.nuget.org/v3/index.json',
    ]);
  }

  core.addPath(toolPath);
  core.info(`trx-to-vsplaylist v${toolVersion} installed to ${toolPath}`);
}
