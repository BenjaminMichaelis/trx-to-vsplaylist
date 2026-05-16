import * as core from '@actions/core';
import { ensureDotnet } from './setup-dotnet.js';
import { installTool } from './install-tool.js';
import { convert } from './convert.js';
import { uploadPlaylistArtifact } from './upload-artifact.js';

export async function run() {
  try {
    // Phase 1: Ensure .NET SDK is available
    await ensureDotnet();

    // Phase 2: Install trx-to-vsplaylist dotnet tool
    await installTool();

    // Phase 3: Convert TRX to Playlist
    const artifactDir = await convert();

    // Phase 4: Upload playlist artifacts
    await uploadPlaylistArtifact(artifactDir);
  } catch (error) {
    core.setFailed(error.message);
  }
}
