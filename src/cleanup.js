import * as core from '@actions/core';
import fs from 'fs';

export function cleanup() {
  const toolPath = core.getState('toolPath');
  if (toolPath && fs.existsSync(toolPath)) {
    fs.rmSync(toolPath, { recursive: true, force: true });
    core.info(`Cleaned up tool directory: ${toolPath}`);
  }
}
