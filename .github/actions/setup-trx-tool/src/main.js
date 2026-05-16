const core = require('@actions/core')
const exec = require('@actions/exec')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

async function installTool(toolPath, toolVersion) {
  const installArgs = [
    'tool',
    'install',
    '--tool-path',
    toolPath,
    'trx-to-vsplaylist',
    '--version',
    toolVersion,
    '--source',
    'https://api.nuget.org/v3/index.json'
  ]

  try {
    await exec.exec('dotnet', installArgs)
  } catch {
    const updateArgs = [
      'tool',
      'update',
      '--tool-path',
      toolPath,
      'trx-to-vsplaylist',
      '--version',
      toolVersion,
      '--source',
      'https://api.nuget.org/v3/index.json'
    ]
    await exec.exec('dotnet', updateArgs)
  }
}

async function run() {
  try {
    const toolVersion = core.getInput('tool-version', {required: true})
    const runnerTemp = process.env.RUNNER_TEMP || os.tmpdir()
    const toolPath = path.join(runnerTemp, '.dotnet-tools-trx-to-vsplaylist')

    fs.mkdirSync(toolPath, {recursive: true})
    core.saveState('tool-path', toolPath)
    core.saveState('tool-version', toolVersion)

    core.info(`Installing trx-to-vsplaylist ${toolVersion}...`)
    await installTool(toolPath, toolVersion)
    core.addPath(toolPath)
    core.info(`trx-to-vsplaylist ${toolVersion} is ready`)
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error))
  }
}

run()
