/**
 * Thalia server.
 * 
 * Class which allows initialisation of a server.
 */

import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from 'http'
import { EventEmitter } from 'events'
import { ServerMode, ServerOptions } from './types'
import { join } from 'path'
import { existsSync, createReadStream } from 'fs'

export class Server extends EventEmitter {
  private httpServer: HttpServer | null = null
  private port: number
  private mode: ServerMode
  private rootPath: string

  constructor(options: ServerOptions) {
    super()
    this.port = options.port || 3000
    this.mode = options.mode || 'development'
    this.rootPath = options.rootPath || process.cwd()
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // Only handle GET requests for now
    if (req.method !== 'GET') {
      res.writeHead(405)
      res.end('Method Not Allowed')
      return
    }

    // Get the requested file path
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const path = url.pathname === '/' ? '/index.html' : url.pathname
    const filePath = join(this.rootPath, path)

    // Check if file exists
    if (!existsSync(filePath)) {
      res.writeHead(404)
      res.end('Not Found')
      return
    }

    // Stream the file
    const stream = createReadStream(filePath)
    stream.on('error', (error) => {
      console.error('Error streaming file:', error)
      res.writeHead(500)
      res.end('Internal Server Error')
    })

    // Set content type based on file extension
    const contentType = this.getContentType(filePath)
    res.setHeader('Content-Type', contentType)

    // Pipe the file to the response
    stream.pipe(res)
  }

  private getContentType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase()
    const contentTypes: { [key: string]: string } = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'text/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'txt': 'text/plain'
    }
    return contentTypes[ext || ''] || 'application/octet-stream'
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer = createServer(this.handleRequest.bind(this))
      this.httpServer.listen(this.port, () => {
        console.log(`Server running at http://localhost:${this.port}`)
        this.emit('started')
        resolve()
      })
    })
  }

  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.httpServer) {
        resolve()
        return
      }

      this.httpServer.close((err) => {
        if (err) {
          reject(err)
          return
        }
        this.httpServer = null
        this.emit('stopped')
        resolve()
      })
    })
  }

  public getMode(): ServerMode {
    return this.mode
  }

  public getPort(): number {
    return this.port
  }

  public getRootPath(): string {
    return this.rootPath
  }
}