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
    const { artifactDir, freshPlaylists } = await convert();

    // Phase 4: Upload playlist artifacts (only fresh files, not stale ones)
    await uploadPlaylistArtifact(freshPlaylists, artifactDir);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
    core.debug(error instanceof Error ? error.stack : String(error));
  }
}
