const core = require('@actions/core')
const fs = require('node:fs')

function cleanupTool(toolPath) {
  if (!toolPath) {
    core.info('No tool path state found. Skipping cleanup.')
    return
  }

  if (!fs.existsSync(toolPath)) {
    core.info(`Tool path does not exist: ${toolPath}`)
    return
  }

  fs.rmSync(toolPath, {recursive: true, force: true})
  core.info(`Removed tool path: ${toolPath}`)
}

function run() {
  try {
    const toolPath = core.getState('tool-path')
    cleanupTool(toolPath)
  } catch (error) {
    core.warning(
      `Cleanup warning: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

run()
