import * as core from '@actions/core';
import { convert } from './convert.js';
import { uploadPlaylistArtifact } from './upload-artifact.js';

export async function run(): Promise<void> {
  try {
    // Phase 1: Convert TRX to Playlist
    const { artifactDir, freshPlaylists } = await convert();

    // Phase 2: Upload playlist artifacts (only fresh files, not stale ones)
    await uploadPlaylistArtifact(freshPlaylists, artifactDir);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
    core.debug(error instanceof Error ? (error.stack ?? String(error)) : String(error));
  }
}
