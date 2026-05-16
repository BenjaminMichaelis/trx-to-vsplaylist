import { DefaultArtifactClient } from '@actions/artifact';
import * as core from '@actions/core';

export async function uploadPlaylistArtifact(files, artifactDir) {
  const artifactName =
    core.getInput('artifact-name') ||
    `test-results-${process.env.GITHUB_RUN_ID}`;

  if (files.length === 0) {
    // Matches composite action's if-no-files-found: 'warn'
    core.warning('No playlist files found to upload');
    return;
  }

  const client = new DefaultArtifactClient();
  const { id, size } = await client.uploadArtifact(
    artifactName,
    files,
    artifactDir
  );
  core.info(`Uploaded artifact '${artifactName}' (id: ${id}, size: ${size})`);
}
