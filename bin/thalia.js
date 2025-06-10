#!/usr/bin/env node

const { startServer } = require('../dist/server')

const args = process.argv.slice(2)
const options = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
  project: process.env.PROJECT
}

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && i + 1 < args.length) {
    options.port = parseInt(args[i + 1], 10)
    i++
  } else if (args[i] === '--project' && i + 1 < args.length) {
    options.project = args[i + 1]
    i++
  }
}

startServer(options).catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})