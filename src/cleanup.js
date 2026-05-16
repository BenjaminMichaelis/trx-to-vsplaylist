import * as core from '@actions/core';
import fs from 'fs';

export function cleanup() {
  const toolPath = core.getState('toolPath');
  if (!toolPath) {
    core.debug('No tool path saved — nothing to clean up');
    return;
  }
  try {
    if (fs.existsSync(toolPath)) {
      fs.rmSync(toolPath, { recursive: true, force: true });
      core.info(`Cleaned up tool directory: ${toolPath}`);
    }
  } catch (err) {
    core.warning(`Failed to clean up tool directory ${toolPath}: ${err.message}`);
  }
}
