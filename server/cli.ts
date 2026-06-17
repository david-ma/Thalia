#!/usr/bin/env bun
/*
 * Command Line Interface for Thalia
 *
 * There are a few ways of running Thalia:
 * standalone, in a project directory:
 *  `npx thalia` this will launch the server in standalone mode, in the current directory
 *  In this case, thalia is an npm package that has been installed there.
 *
 * multiplex.
 * Also `npx thalia`
 * In this case, you have a thalia deployment, with multiple projects in the /websites directory.
 *
 * dev mode.
 * npx thalia --project=PROJECT
 * In this case, you have a thalia deployment, with multiple projects in the /websites directory, and you want to run a specific project.
 *
 * --port=PORT will override the default port of 1337, in any mode
 * PORT and PROJECT can also be set in the environment variables PORT and PROJECT
 */

import { cwd } from 'process'
import { ServerOptions } from './types'
import path from 'path'
import { Thalia } from './thalia'
import fs from 'fs'
import { getPort } from 'get-port-please'
import { startupMark, startupSummary } from './startup-timer'

async function probeLocalHttp(port: number): Promise<void> {
  const url = `http://127.0.0.1:${port}/version`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    console.debug(`Startup probe OK: GET ${url} → HTTP ${res.status}`)
  } catch (error) {
    console.error(
      `Startup probe FAILED: GET ${url} — process is up but not accepting HTTP locally.`,
      error instanceof Error ? error.message : error,
    )
  } finally {
    clearTimeout(timeout)
  }
}

const project =
  process.argv.find((arg) => arg.startsWith('--project'))?.split('=')[1] || process.env['PROJECT'] || 'default'
const portArg = process.argv.find((arg) => arg.startsWith('--port'))?.split('=')[1] || process.env['PORT']
const preferredPort = portArg ? parseInt(portArg) : 1337

if (process.env['NODE_ENV'] === 'production' && process.env['LOG_LEVEL']?.toLowerCase() !== 'debug') {
  console.debug = () => {}
}

async function main() {
  startupMark('cli.begin')

  // Get available port (prefer 1337, or use --port if provided)
  const port = await getPort({ port: preferredPort })
  startupMark(`cli.port:${port}`)

  let options: ServerOptions = {
    node_env: process.env['NODE_ENV'] || 'development',
    mode: 'standalone',
    project: project,
    rootPath: cwd(),
    port: port,
  }
  console.log('Checking if websites directory exists at', path.join(options.rootPath, 'websites'))
  if (!fs.existsSync(path.join(options.rootPath, 'websites'))) {
    // If there's no websites directory, we're in standalone mode
    options.mode = 'standalone'
    options.project = path.basename(options.rootPath)
  } else if (project == 'default') {
    console.log(`Running in multiplex mode. Loading all projects.`)
    options.mode = 'multiplex'
    options.rootPath = path.join(options.rootPath, 'websites')
  } else {
    console.log(`Running in standalone mode for project: ${project}`)
    options.mode = 'standalone'
    options.rootPath = path.join(options.rootPath, 'websites', project)
  }

  console.log('Creating Thalia with options:', options)
  startupMark('cli.before-init')
  Thalia.init(options)
    .then(async (thalia) => {
      startupMark('cli.after-init')
      await thalia.start()
      startupMark('cli.after-listen')
      startupSummary()

      if (process.env.THALIA_STARTUP_PROBE === '1') {
        await probeLocalHttp(port)
      }

      console.debug('Ready — waiting for HTTP requests (no further output until a request arrives).')

      let shuttingDown = false

      async function shutdown(signal: string): Promise<void> {
        if (shuttingDown) return
        shuttingDown = true

        console.log(`Received ${signal}. Stopping Thalia...`)

        const timeoutMs = 10_000
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Shutdown timeout after ${timeoutMs}ms`)), timeoutMs),
        )

        try {
          await Promise.race([thalia.stop(), timeout])
          console.log('Thalia stopped')
          process.exit(0)
        } catch (error) {
          console.error('Error stopping Thalia:', error)
          process.exit(1)
        }
      }

      process.on('SIGINT', () => {
        void shutdown('SIGINT')
      })

      process.on('SIGTERM', () => {
        void shutdown('SIGTERM')
      })
    })
    .catch((error) => {
      console.error('Error starting Thalia:', error)
      process.exit(1)
    })
}

main()
