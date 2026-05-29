import * as core from '@actions/core';
import * as io from '@actions/io';
import { convert } from './convert.js';
import { ensureDotnet } from './setup-dotnet.js';
import { installTool } from './install-tool.js';
import { uploadPlaylistArtifact } from './upload-artifact.js';

async function ensurePrerequisites(): Promise<void> {
  const existingTool = await io.which('trx-to-vsplaylist', false);
  if (existingTool) {
    core.info(`trx-to-vsplaylist already available at ${existingTool}`);
    return;
  }

  await ensureDotnet();
  await installTool();
}

export async function run(): Promise<void> {
  try {
    // Local actions (uses: ./) do not support pre lifecycle hooks, so
    // prerequisites must also be ensured at runtime.
    await ensurePrerequisites();

    // Phase 1: Convert TRX to Playlist
    const { artifactDir, freshPlaylists } = await convert();

    // Phase 2: Upload playlist artifacts (only fresh files, not stale ones)
    await uploadPlaylistArtifact(freshPlaylists, artifactDir);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
    core.debug(error instanceof Error ? (error.stack ?? String(error)) : String(error));
  }
}
