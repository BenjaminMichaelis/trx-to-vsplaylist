import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveArtifactName } from '../src/upload-artifact.js';

describe('resolveArtifactName', () => {
  it('returns the provided artifact name when present', () => {
    const name = resolveArtifactName({
      inputName: 'merged-failures',
      createSuffix: () => 'unused',
    });

    assert.equal(name, 'merged-failures');
  });

  it('builds a unique default name from run metadata', () => {
    const name = resolveArtifactName({
      inputName: '',
      env: {
        GITHUB_RUN_ID: '12345',
        GITHUB_RUN_ATTEMPT: '7',
      },
      createSuffix: () => 'unique-suffix',
    });

    assert.equal(name, 'test-results-12345-7-unique-suffix');
  });

  it('falls back to a local prefix when run metadata is unavailable', () => {
    const name = resolveArtifactName({
      inputName: '',
      env: {},
      createSuffix: () => 'unique-suffix',
    });

    assert.equal(name, 'test-results-local-unique-suffix');
  });
});
