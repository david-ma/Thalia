#!/usr/bin/env node

import { cwd } from 'process'
import { Server } from '../dist/server/server.js'
import { ServerOptions } from '../dist/server/types.js'
import { Website } from '../dist/server/website.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const project = process.argv.find(arg => arg.startsWith('--project'))?.split('=')[1] || process.env['PROJECT'] || 'default'
const port = parseInt(process.argv.find(arg => arg.startsWith('--port'))?.split('=')[1] || process.env['PORT'] || '3000')

let options: ServerOptions = {
  mode: 'standalone',
  project: project,
  rootPath: cwd(),
  port: port
}

if (project == 'default') {
  console.log(`Running in multiplex mode. Loading all projects.`)
  options.mode = 'multiplex'
  options.rootPath = path.join(options.rootPath, 'websites')
} else {
  console.log(`Running in standalone mode for project: ${project}`)
  options.mode = 'standalone'
  options.rootPath = path.join(options.rootPath, 'websites', project)
}

const websites = Website.loadAllWebsites(options)
const server = new Server(options, websites)

server.start()