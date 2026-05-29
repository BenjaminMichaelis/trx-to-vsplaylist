import { randomUUID } from 'node:crypto';
import { DefaultArtifactClient } from '@actions/artifact';
import * as core from '@actions/core';

type ArtifactNameOptions = {
  inputName?: string;
  env?: NodeJS.ProcessEnv;
  createSuffix?: () => string;
};

export function resolveArtifactName({
  inputName = core.getInput('artifact-name'),
  env = process.env,
  createSuffix = randomUUID,
}: ArtifactNameOptions = {}): string {
  const trimmedInputName = inputName.trim();
  if (trimmedInputName) {
    return trimmedInputName;
  }

  const runId = env.GITHUB_RUN_ID?.trim() || 'local';
  const runAttempt = env.GITHUB_RUN_ATTEMPT?.trim();
  const suffix = createSuffix();

  return runAttempt
    ? `test-results-${runId}-${runAttempt}-${suffix}`
    : `test-results-${runId}-${suffix}`;
}

export async function uploadPlaylistArtifact(
  files: string[],
  artifactDir: string
): Promise<void> {
  const artifactName = resolveArtifactName();

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
