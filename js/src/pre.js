import * as core from '@actions/core'
import { exec } from 'node:child_process'

function runCommand(command) {
  return new Promise((resolve, reject) => {
    const child = exec(command, { windowsHide: true }, (error, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout)
      if (stderr) process.stderr.write(stderr)
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

async function run() {
  try {
    core.info('Setting up .NET and installing trx-to-vsplaylist tool (pre step)...')

    // Match the composite action: setup .NET 10.x GA and install the tool globally
    await runCommand('dotnet --info')

    await runCommand('dotnet tool install --global trx-to-vsplaylist --version 1.3.0 --source https://api.nuget.org/v3/index.json')

    core.info('✅ trx-to-vsplaylist tool installed successfully in pre step')
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`Pre step failed: ${error.message}`)
    } else {
      core.setFailed('Pre step failed with unknown error')
    }
  }
}

run()
