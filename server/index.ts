import * as server from './server'
import * as router from './router'
const requestHandlers = require('./requestHandlers')
const fs = require('fs')

function startServer() {
  var argv = require('minimist')(process.argv.slice(2))

  let port: string = '1337' // change the port here?
  const pattern = /^\d{0,5}$/
  let workspace = 'default'

  if (process.argv[2] !== null && pattern.exec(process.argv[2])) {
    port = process.argv[2]
  } else if (process.argv[3] !== null && pattern.exec(process.argv[3])) {
    port = process.argv[3]
  }

  // Todo: we should check that the workspace exists, otherwise leave it as default
  if (
    process.argv[2] !== null &&
    process.argv[2] !== undefined &&
    !pattern.exec(process.argv[2])
  ) {
    workspace = process.argv[2]
  } else if (
    process.argv[3] !== null &&
    process.argv[3] !== undefined &&
    !pattern.exec(process.argv[3])
  ) {
    workspace = process.argv[3]
  }

  if (argv.s !== undefined) {
    workspace = argv.w
  }
  if (argv.site !== undefined) {
    workspace = argv.site
  }

  if (argv.p !== undefined && pattern.exec(argv.port)) {
    port = argv.p
  }
  if (argv.port !== undefined && pattern.exec(argv.port)) {
    port = argv.port
  }

  if (fs.existsSync(`websites/${workspace}`)) {
    console.log(`Setting workspace to websites/${workspace}`)
  } else if (fs.existsSync('config.js') || fs.existsSync('config/config.js')) {
    console.log('Thalia running in stand alone mode.')
  } else {
    console.error(`Error. ${workspace} is an invalid workspace`)
    process.exit(1)
  }

  requestHandlers.handle.index.localhost = workspace
  requestHandlers.handle.loadAllWebsites()
  server.start(router.router, requestHandlers.handle, port)
}

export { startServer }
