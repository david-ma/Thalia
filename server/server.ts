/**
 * Thalia server.
 * 
 * Class which allows initialisation of a server.
 */



import { IncomingMessage, ServerResponse } from 'http'
import { createServer, Server as HttpServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import { EventEmitter } from 'events'
import * as path from 'path'
import * as fs from 'fs'
import { ServerMode, ServerOptions } from './core/types'

// server.ts
import http = require('http')
import url = require('url')
import httpProxy = require('http-proxy')


import formidable = require('formidable')

// This part of the server starts the server on port 80 and logs stuff to the std.out
function start(router: Thalia.Router, handle: Thalia.Handle, port: string) {
  let server = null

  function onRequest(request: IncomingMessage, response: ServerResponse) {
    const host: string = (request.headers['x-host'] as string) || request.headers.host

    const ip =
      request.headers['X-Real-IP'] ||
      request.headers['x-real-ip'] ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress

    // let port = host.split(":")[1] ? parseInt(host.split(":")[1]) : 80
    const hostname = host.split(':')[0]

    const site = handle.getWebsite(hostname)
    const urlObject: url.UrlWithParsedQuery = url.parse(request.url, true)

    const proxies: Thalia.Proxies = handle.proxies[hostname]
    const filterWord = url.parse(request.url).pathname.split('/')[1]
    const proxy: Thalia.Proxy = proxies ? proxies[filterWord] || proxies['*'] || null : null

    if (proxy) {
      if (!proxy.silent) log()
      webProxy(proxy)
    } else {
      log()
      router(site, urlObject.pathname, response, request)
    }

    function log() {
      console.log()
      console.log(`Request for ${host}${urlObject.href} At ${getDateTime()} From ${ip}`)
    }

    function webProxy(config: Thalia.Proxy) {
      console.log('Proxy found, trying to proxy', config)

      if (config.password) {
        const cookies: Cookies = getCookies(request)
        if (cookies[`password${config.filter || ''}`] !== encode(config.password)) {
          loginPage(config.password, config.filter)
          return
        }

        if (config.host === '127.0.0.1' && config.port === 80 && !config.filter) {
          log()
          router(site, urlObject.pathname, response, request)
          return
        }
      }

      const message = config.message || 'Error, server is down.'
      const target = `http://${config.host || '127.0.0.1'}:${config.port || 80}`

      const proxyServer = httpProxy.createProxyServer({
        // preserveHeaderKeyCase: true,
        // autoRewrite: true,
        // followRedirects: true,
        // protocolRewrite: "http",
        // changeOrigin: true,
        target: target,
      })

      proxyServer.on('error', function (err: any, req: any, res: any) {
        'use strict'
        console.log(err)
        try {
          res.writeHead(500)
          res.end(message)
        } catch (e) {
          console.log('Error doing proxy!', e)
        }
      })

      proxyServer.web(request, response)
    }

    function loginPage(password: string, filter: string) {
      if (request.url.indexOf('login') >= 0) {
        const form = new formidable.IncomingForm()
        form.parse(request, (err: any, fields: any) => {
          console.log('Fields is:', fields)
          if ((fields.password && fields.password === password) || fields.password[0] === password) {
            const encodedPassword = encode(password)
            response.setHeader('Set-Cookie', [
              `password${filter || ''}=${encodedPassword};path=/;max-age=${24 * 60 * 60}`,
            ])
            const url = `//${host}/${filter || ''}`

            response.writeHead(303, { 'Content-Type': 'text/html' })
            response.end(
              `<html><head><meta http-equiv="refresh" content="0;url='${url}'"></head>
<body>Login Successful, redirecting to: <a href='${url}'>${url}</a></body></html>`
            )
          } else {
            response.writeHead(401)
            response.end('Wrong password')
          }
        })
      } else {
        response.writeHead(200)

        if (filter) {
          response.end(simpleLoginPage.replace('/login', `/${filter}/login`))
        } else {
          response.end(simpleLoginPage)
        }
      }
    }
  }

  console.log('Server has started on port: ' + port)
  server = http.createServer(onRequest).listen(port)

  server.on('error', function (e: any) {
    console.log('Server error', e)
  })

  server.on('upgrade', function (request: any, socket: any, head: any) {
    'use strict'

    let host: string = (request.headers['x-host'] as string) || request.headers.host
    // let port = host.split(":")[1] ? parseInt(host.split(":")[1]) : 80
    host = host.split(':')[0]

    const proxies: Thalia.Proxies = handle.proxies[host]
    let filterWord = url.parse(request.url).pathname.split('/')[1]

    if (proxies) {
      let proxyConfig: Thalia.Proxy = null
      if (filterWord) {
        proxyConfig = proxies[filterWord]
      } else {
        proxyConfig = proxies['*']
      }

      // HTTP Proxy options
      // https://github.com/http-party/node-http-proxy/blob/HEAD/lib/http-proxy.js#L26-L42
      const proxyServer = httpProxy.createProxyServer({
        ws: true,
        target: {
          host: proxyConfig && proxyConfig.host ? proxyConfig.host : '127.0.0.1',
          port: proxyConfig && proxyConfig.port ? proxyConfig.port : 80,
        },
      })

      proxyServer.on('error', function (err: any, req: any, res: any) {
        'use strict'
        console.log(err)
        try {
          res.writeHead(500)
          res.end(proxyConfig.message)
        } catch (e) {
          console.log('Error doing upgraded proxy!', e)
        }
      })

      proxyServer.ws(request, socket, head)
    }
  })

  return server
}

// exports.start = start;
export { start }

function getDateTime() {
  //    var date = new Date();
  const date = new Date(Date.now() + 36000000)
  // add 10 hours... such a shitty way to make it australian time...

  let hour: any = date.getHours()
  hour = (hour < 10 ? '0' : '') + hour

  let min: any = date.getMinutes()
  min = (min < 10 ? '0' : '') + min

  const year = date.getFullYear()

  let month: any = date.getMonth() + 1
  month = (month < 10 ? '0' : '') + month

  let day: any = date.getDate()
  day = (day < 10 ? '0' : '') + day

  return year + ':' + month + ':' + day + ' ' + hour + ':' + min
}

type Cookies = {
  [key: string]: string
}

function getCookies(request: IncomingMessage) {
  const cookies: Cookies = {}
  if (request.headers.cookie) {
    request.headers.cookie.split(';').forEach(function (d: any) {
      cookies[d.split('=')[0].trim()] = d.substring(d.split('=')[0].length + 1).trim()
    })
  }
  return cookies
}

const salt = Math.floor(Math.random() * 999)
function encode(string: string) {
  'use strict'
  // const buff = new Buffer(string)
  const buff = Buffer.from(string)
  return buff.toString('base64') + salt
}

const simpleLoginPage = `<html>
<head>
<title>Login</title>
<style>
div {
    text-align: center;
    width: 300px;
    margin: 200px auto;
    background: lightblue;
    padding: 10px 20px;
    border-radius: 15px;
}
</style>
</head>
<body>
<div>
    <h1>Enter Password</h1>
    <form action="/login" method="post">
        <input type="password" placeholder="Enter Password" name="password" autofocus required>
        <button type="submit">Login</button>
    </form>
</div>
</body>
</html>`

/**
 * ThaliaServer - Core server implementation
 * 
 * The server is responsible for:
 * 1. Creating and managing the HTTP server
 * 2. Setting up WebSocket connections
 * 3. Managing server lifecycle (start/stop)
 * 4. Emitting events for important server state changes
 * 
 * The server is the top-level component that:
 * - Listens on a specified port
 * - Handles incoming HTTP requests
 * - Manages WebSocket connections
 * - Provides server-wide configuration
 * 
 * It does NOT handle:
 * - Request routing (handled by Router)
 * - Request processing (handled by Handler)
 * - Website-specific logic (handled by Website)
 */

export class Server extends EventEmitter {
  private httpServer: HttpServer
  private socketServer: SocketServer
  private port: number
  private mode: ServerMode
  private rootPath: string

  /**
   * Creates a new ThaliaServer instance
   * @param options - Server configuration options
   */
  constructor(options: ServerOptions) {
    super()
    this.port = options.port
    this.mode = options.mode
    this.rootPath = options.rootPath || process.cwd()
    
    // Create HTTP server
    this.httpServer = createServer(this.handleRequest.bind(this))
    
    // Create Socket.IO server
    this.socketServer = new SocketServer(this.httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    })

    // Set up error handling
    this.httpServer.on('error', (error: Error) => {
      this.emit('error', error)
    })

    // Set up socket connection handling
    this.socketServer.on('connection', (socket) => {
      this.emit('connection', socket)
    })
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      // Only handle GET requests
      if (req.method !== 'GET') {
        res.writeHead(405)
        res.end('Method Not Allowed')
        return
      }

      // Get the requested path
      const requestUrl = req.url || '/'
      const host = req.headers.host || 'localhost'
      const url = new URL(requestUrl, `http://${host}`)
      const requestPath = url.pathname

      // Determine the project name from the host
      const projectName = this.mode === 'multiplex' ? host.split('.')[0] : 'example'

      // Build the file path
      const filePath = path.join(
        this.rootPath,
        'websites',
        projectName,
        'public',
        requestPath === '/' ? 'index.html' : requestPath
      )

      // Check if file exists
      try {
        await fs.promises.access(filePath)
      } catch {
        res.writeHead(404)
        res.end('Not Found')
        return
      }

      // Get file stats
      const stats = await fs.promises.stat(filePath)
      if (!stats.isFile()) {
        res.writeHead(404)
        res.end('Not Found')
        return
      }

      // Set content type
      const ext = path.extname(filePath)
      const contentType = this.getContentType(ext)
      res.setHeader('Content-Type', contentType)

      // Stream the file
      const stream = fs.createReadStream(filePath)
      stream.pipe(res)

      // Handle stream errors
      stream.on('error', (error) => {
        console.error('Error streaming file:', error)
        if (!res.headersSent) {
          res.writeHead(500)
          res.end('Internal Server Error')
        }
      })
    } catch (error) {
      console.error('Error handling request:', error)
      if (!res.headersSent) {
        res.writeHead(500)
        res.end('Internal Server Error')
      }
    }
  }

  private getContentType(ext: string): string {
    const contentTypes: { [key: string]: string } = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.txt': 'text/plain'
    }
    return contentTypes[ext] || 'application/octet-stream'
  }

  /**
   * Starts the server and begins listening for connections
   * @returns Promise that resolves when the server is started
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.httpServer.listen(this.port, () => {
          console.log(`Server running in ${this.mode} mode on port ${this.port}`)
          this.emit('started')
          resolve()
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Stops the server and closes all connections
   * @returns Promise that resolves when the server is stopped
   */
  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socketServer.close(() => {
          this.httpServer.close(() => {
            console.log('Server stopped')
            this.emit('stopped')
            resolve()
          })
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Gets the current server mode
   * @returns The server mode
   */
  public getMode(): ServerMode {
    return this.mode
  }

  /**
   * Gets the port the server is listening on
   * @returns The server port
   */
  public getPort(): number {
    return this.port
  }

  /**
   * Gets the root path of the server
   * @returns The server root path
   */
  public getRootPath(): string {
    return this.rootPath
  }

  /**
   * Gets the underlying HTTP server instance
   * @returns The HTTP server
   */
  public getHttpServer(): HttpServer {
    return this.httpServer
  }

  /**
   * Gets the Socket.IO server instance
   * @returns The Socket.IO server
   */
  public getSocketServer(): SocketServer {
    return this.socketServer
  }
}