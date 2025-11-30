#!/usr/bin/env bun

console.log('Starting development server...')

import { spawn } from 'child_process'
import path from 'path'
import browserSync from 'browser-sync'
import fs from 'fs'
import readline from 'readline'

const thaliaDirectory = process.cwd()

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

function startServer(projectName) {
  const env = {
    ...process.env,
    PORT: 1337,
    PROJECT: projectName,
  }

  const projectRoot = path.resolve(thaliaDirectory, 'websites', projectName)

  // Start Bun server with --watch (auto-restart on file changes)
  const server = spawn('bun', ['--watch', 'server/cli.ts', `--project=${projectName}`], {
    env,
    stdio: 'inherit',
    cwd: thaliaDirectory,
  })

  const processes = [server]

  // Start webpack if config exists
  if (fs.existsSync(`${projectRoot}/webpack.config.cjs`) || fs.existsSync(`${projectRoot}/webpack.config.js`)) {
    const webpackConfig = fs.existsSync(`${projectRoot}/webpack.config.cjs`) 
      ? 'webpack.config.cjs' 
      : 'webpack.config.js'
    
    const webpack = spawn('webpack', ['--watch', '--config', webpackConfig], {
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
      proxy: `http://localhost:1337`,
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

  // Cleanup on exit
  process.on('SIGINT', () => {
    console.log('\nShutting down...')
    bs.cleanup()
    bs.exit()
    processes.forEach((p) => p.kill('SIGINT'))
    process.exit(0)
  })
}

function prompt(query) {
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
