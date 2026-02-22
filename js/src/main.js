import * as core from '@actions/core'
import { spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { glob } from 'glob'
import { dirname, basename, join } from 'node:path'
import { existsSync } from 'node:fs'

const globAsync = promisify(glob)

function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('trx-to-vsplaylist', args, {
      stdio: 'inherit',
      shell: true,
      windowsHide: true
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`trx-to-vsplaylist exited with code ${code}`))
      }
    })
  })
}

async function run() {
  try {
    const trxPattern = core.getInput('trx-file-path', { required: true })
    const outputDirectory = core.getInput('output-directory')
    const outcomes = core.getInput('test-outcomes') || 'Failed'
    const skipEmpty = core.getInput('skip-empty') || 'true'
    const separate = core.getInput('separate') || 'false'

    // Expand glob pattern similar to the composite action
    const trxFiles = await globAsync(trxPattern)
    if (!trxFiles || trxFiles.length === 0) {
      throw new Error(`No TRX files found matching pattern: ${trxPattern}`)
    }

    core.info(`Found ${trxFiles.length} TRX file(s): ${trxFiles.join(', ')}`)

    // Determine artifact directory
    let artifactDir
    if (outputDirectory) {
      artifactDir = outputDirectory
    } else {
      artifactDir = dirname(trxFiles[0])
    }

    const args = ['convert', ...trxFiles]

    let outputFile

    if (separate === 'true') {
      // Separate mode: output is a directory
      args.push('--output', artifactDir)
      args.push('--separate')
      core.info(`Using separate mode: creating individual playlists in ${artifactDir}`)
    } else {
      // Merge mode: determine output file name
      const firstBase = basename(trxFiles[0], '.trx')
      if (trxFiles.length > 1) {
        outputFile = join(artifactDir, 'merged.playlist')
      } else {
        outputFile = join(artifactDir, `${firstBase}.playlist`)
      }
      args.push('--output', outputFile)
      core.info(`Using merge mode: creating combined playlist at ${outputFile}`)
    }

    if (skipEmpty !== 'false') {
      args.push('--skip-empty')
    }

    if (outcomes) {
      for (const outcome of outcomes.split(',')) {
        const trimmed = outcome.trim()
        if (trimmed) {
          args.push('--outcome', trimmed)
        }
      }
    }

    core.info(`Running trx-to-vsplaylist with args: ${args.join(' ')}`)

    await runCli(args)

    // After running, set outputs similar to the composite action
    if (separate === 'true') {
      const playlistFiles = await globAsync('**/*.playlist', { cwd: artifactDir, absolute: true })
      if (!playlistFiles || playlistFiles.length === 0) {
        if (skipEmpty === 'false') {
          throw new Error('No playlist files were created')
        } else {
          core.info('No playlist files were created (likely due to --skip-empty and no matching tests)')
        }
      } else {
        core.info(`Successfully created ${playlistFiles.length} playlist file(s)`)
      }

      const joined = playlistFiles.join(':')
      core.setOutput('playlist-paths', joined)
    } else if (outputFile) {
      if (existsSync(outputFile)) {
        core.info(`Successfully created playlist file: ${outputFile}`)
        core.setOutput('playlist-path', outputFile)
      } else if (skipEmpty === 'false') {
        throw new Error(`Playlist file was not created at: ${outputFile}`)
      } else {
        core.info('Playlist file was not created (likely due to --skip-empty and no matching tests)')
      }
    }

    core.setOutput('artifact-dir', artifactDir)
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('Unknown error in main step')
    }
  }
}

run()
