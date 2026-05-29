import * as core from '@actions/core';
import { ensureDotnet } from './setup-dotnet.js';
import { installTool } from './install-tool.js';

export async function run(): Promise<void> {
  try {
    // Phase 1: Ensure .NET SDK is available
    await ensureDotnet();

    // Phase 2: Install trx-to-vsplaylist dotnet tool
    await installTool();
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
    core.debug(error instanceof Error ? (error.stack ?? String(error)) : String(error));
  }
}

run();
