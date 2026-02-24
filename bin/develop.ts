#!/usr/bin/env bun

import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import * as os from 'os'
import browserSync from 'browser-sync'
import fs from 'fs'
import readline from 'readline'
import { getPort } from 'get-port-please'
import { spinner } from '../server/util.js'

console.log(`Starting Thalia development server using develop.ts at ${new Date().toISOString()}`)

// Get a port using get-port-please
const preferredPort = process.env.PORT ? parseInt(process.env.PORT) : 1337
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

/** Tee a child's stdout/stderr to terminal and log files. Call after spawn with stdio: ['inherit','pipe','pipe']. */
function teeChildOutput(
  child: ChildProcess,
  logStream: fs.WriteStream,
  errStream: fs.WriteStream
) {
  if (child.stdout) child.stdout.on('data', (chunk) => { process.stdout.write(chunk); logStream.write(chunk) })
  if (child.stderr) child.stderr.on('data', (chunk) => { process.stderr.write(chunk); errStream.write(chunk) })
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
  let logDir: string
  if (process.env.LOG_DIR) {
    logDir = process.env.LOG_DIR
  } else {
    try {
      if (fs.existsSync('/tmp') && fs.statSync('/tmp').isDirectory()) {
        fs.accessSync('/tmp', fs.constants.W_OK)
        logDir = '/tmp'
      } else {
        logDir = os.tmpdir()
      }
    } catch {
      logDir = os.tmpdir()
    }
  }
  const logPath = path.join(logDir, `thalia-${projectName}.log`)
  const errPath = path.join(logDir, `thalia-${projectName}.err`)
  // Use the flag 'a' if we want to append to the file, 'w' if we want to overwrite it.
  const logStream = fs.createWriteStream(logPath, { flags: 'w' })
  const errStream = fs.createWriteStream(errPath, { flags: 'w' })
  console.log(`Logs: ${logPath} (stdout), ${errPath} (stderr)`)

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: port.toString(),
    PROJECT: projectName,
  }

  let server: ChildProcess

  if (standalone) {
    server = spawn('bun', ['--hot', 'thalia'], {
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
      cwd: projectRoot,
    })
  } else {
    server = spawn('bun', ['--hot', path.join('server', 'cli.ts'), `--project=${projectName}`], {
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
      cwd: thaliaDirectory,
    })
  }
  teeChildOutput(server, logStream, errStream)

  const processes: ChildProcess[] = [server]

  const webpackCjs = path.join(projectRoot, 'webpack.config.cjs')
  const webpackJs = path.join(projectRoot, 'webpack.config.js')
  if (fs.existsSync(webpackCjs) || fs.existsSync(webpackJs)) {
    const webpackConfig = fs.existsSync(webpackCjs) ? 'webpack.config.cjs' : 'webpack.config.js'
    const webpack = spawn('npx', ['webpack', '--watch', '--config', webpackConfig], {
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
      cwd: projectRoot,
    })
    teeChildOutput(webpack, logStream, errStream)
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
        path.join(projectRoot, '**', '*'),
        path.join(thaliaDirectory, 'server', '**', '*'),
        path.join(thaliaDirectory, 'src', '**', '*.hbs'),
      ],
      watchOptions: {
        ignored: '**/node_modules/**',
      },
    })
  }, 1000)

  // Cleanup function
  const cleanup = () => {
    console.log("\nProcesses to quit: ");
    processes.forEach((process)=>{
      console.log(`${process.pid} ${process.spawnargs.join(" ")}`)
    })

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
      console.log("Done!")
      process.exit(0)
    })
  }

  // Handle all exit signals
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  process.on('SIGQUIT', cleanup)
  process.on('SIGBREAK', cleanup)
  process.on('SIGABRT', cleanup)
  process.on('SIGSEGV', cleanup)
  process.on('SIGILL', cleanup)
  process.on('SIGFPE', cleanup)
  process.on('SIGBUS', cleanup)
  process.on('SIGPIPE', cleanup)
  process.on('SIGALRM', cleanup)

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
