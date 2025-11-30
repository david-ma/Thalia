#!/usr/bin/env bun

console.log('Starting development server...')

import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import browserSync from 'browser-sync'
import fs from 'fs'
import readline from 'readline'
import { getPort } from 'get-port-please'

const thaliaDirectory = process.cwd()

// Get a port using get-port-please
const preferredPort = 1337
const port = await getPort({ port: preferredPort })

// Get project name from command line arguments
let projectName = process.argv[2]
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
  startServer(projectName)
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
      startServer(projectName)
    })
}

function startServer(projectName: string) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: port.toString(),
    PROJECT: projectName,
  }

  const projectRoot = path.resolve(thaliaDirectory, 'websites', projectName)

  // Start Bun server with --watch (auto-restart on file changes)
  const server = spawn('bun', ['--watch', 'server/cli.ts', `--project=${projectName}`], {
    env,
    stdio: 'inherit',
    cwd: thaliaDirectory,
  })

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
      files: [
        `${projectRoot}/**/*`,
        `${thaliaDirectory}/server/**/*`,
        `${thaliaDirectory}/src/**/*.hbs`
      ],
    })
  }, 1000)

  // Cleanup function
  const cleanup = () => {
    console.log('\nShutting down...')
    
    // Kill all child processes
    processes.forEach((p) => {
      if (p && !p.killed) {
        p.kill('SIGTERM')
        // Force kill after 2 seconds if still alive
        setTimeout(() => {
          if (p && !p.killed) {
            p.kill('SIGKILL')
          }
        }, 2000)
      }
    })
    
    // Cleanup BrowserSync
    bs.cleanup()
    bs.exit()
    
    setTimeout(() => process.exit(0), 2500)
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
