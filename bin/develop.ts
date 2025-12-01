#!/usr/bin/env bun

console.log('Starting development server...')

import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import browserSync from 'browser-sync'
import fs from 'fs'
import readline from 'readline'
import { getPort } from 'get-port-please'
import { spinner } from '../server/util.js'

// Get a port using get-port-please
const preferredPort = 1337
const port = await getPort({ port: preferredPort })

// This develop script can be run in two modes:
// 1. From a project directory, with a websites directory
// 2. From the root of a Thalia installation, with no websites directory
// 2.1 If we're in the root of a Thalia installation, we might be passed a project name as an argument
// 2.2 If we are not passed a project name, we will ask the user to select a project from the list of projects

const rootPath = process.cwd()
let thaliaDirectory = rootPath

// Try to get project name from command line arguments
let projectName = process.argv[2]

// If there's no websites directory, we must be in standalone mode
if (!fs.existsSync(path.join(rootPath, 'websites'))) {
  console.log('No websites directory found')
  thaliaDirectory = path.join(rootPath, 'node_modules', 'thalia')
  projectName = path.basename(rootPath)
  startServer({ projectName, projectRoot: rootPath, thaliaDirectory, standalone: true })
} else {
  // If there's a websites directory, we're running from the Thalia directory

  const rawListOfProjects = fs
    .readdirSync(path.resolve(thaliaDirectory, 'websites'))
    .filter((file) => fs.statSync(path.resolve(thaliaDirectory, 'websites', file)).isDirectory())
    .filter((file) => file !== 'default')

  const listOfProjects = rawListOfProjects

  if (projectName) {
    if (!listOfProjects.includes(projectName)) {
      console.error(`Project ${projectName} not found`)
      process.exit(1)
    }
    startServer({
      projectName,
      projectRoot: path.resolve(thaliaDirectory, 'websites', projectName),
      thaliaDirectory,
      standalone: false,
    })
  } else {
    // No project name provided? Ask for it
    console.log('Available projects:')
    console.log(listOfProjects.map((project, index) => `${index + 1}. ${project}`).join('\n'))

    prompt('Enter the number of the project: ')
      .then((projectNumber) => {
        const projectNumberInt = parseInt(projectNumber)
        if (isNaN(projectNumberInt) || projectNumberInt < 1 || projectNumberInt > listOfProjects.length) {
          console.error('Please enter a valid project number')
          process.exit(1)
        }
        return listOfProjects[projectNumberInt - 1]
      })
      .then((projectName) => {
        if (!projectName) {
          console.error('Please specify a project name')
          process.exit(1)
        }
        console.log(`Starting server for project: ${projectName}\n`)
        startServer({
          projectName,
          projectRoot: path.resolve(thaliaDirectory, 'websites', projectName),
          thaliaDirectory,
          standalone: false,
        })
      })
  }
}

function startServer({
  projectName,
  projectRoot,
  thaliaDirectory,
  standalone,
}: {
  projectName: string
  projectRoot: string
  thaliaDirectory: string
  standalone: boolean
}) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: port.toString(),
    PROJECT: projectName,
  }

  let server: ChildProcess

  if (standalone) {
    // Start Bun server with --watch (auto-restart on file changes)
    server = spawn('bun', ['--watch', 'thalia'], {
      env,
      stdio: 'inherit',
      cwd: projectRoot,
    })
  } else {
    // Start Bun server with --watch (auto-restart on file changes)
    server = spawn('bun', ['--watch', 'server/cli.ts', `--project=${projectName}`], {
      env,
      stdio: 'inherit',
      cwd: thaliaDirectory,
    })
  }

  const processes: ChildProcess[] = [server]

  // Start webpack if config exists
  if (fs.existsSync(`${projectRoot}/webpack.config.cjs`) || fs.existsSync(`${projectRoot}/webpack.config.js`)) {
    const webpackConfig = fs.existsSync(`${projectRoot}/webpack.config.cjs`)
      ? 'webpack.config.cjs'
      : 'webpack.config.js'

    const webpack = spawn('npx', ['webpack', '--watch', '--config', webpackConfig], {
      env,
      stdio: 'inherit',
      cwd: projectRoot,
    })
    processes.push(webpack)
  }

  // BrowserSync for live reload
  const bs = browserSync.create()

  setTimeout(() => {
    bs.init({
      proxy: `http://localhost:${port}`,
      port: 3000,
      open: false,
      notify: false,
      reloadDelay: 1000,
      files: [`${projectRoot}/**/*`, `${thaliaDirectory}/server/**/*`, `${thaliaDirectory}/src/**/*.hbs`],
    })
  }, 1000)

  // Cleanup function
  const cleanup = () => {
    const line = spinner('Shutting down...')

    Promise.all([
      ...processes.map((p) => {
        if (p && !p.killed) {
          p.kill('SIGTERM')
          // Force kill after 2 seconds if still alive
          setTimeout(() => {
            if (p && !p.killed) {
              p.kill('SIGKILL')
            }
          }, 1500)
        }
      }),
      bs.cleanup(),
      bs.exit(),
    ]).then(() => {
      line()
      process.exit(0)
    })
  }

  // Handle all exit signals
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err)
    cleanup()
  })
}

function prompt(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  rl.setPrompt(query)
  rl.prompt()
  return new Promise((resolve) => {
    rl.on('line', (userInput) => {
      rl.close()
      resolve(userInput)
    })
  })
}
