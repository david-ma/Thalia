/**
 * Thalia server.
 * 
 * Class which allows initialisation of a server.
 */

import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from 'http'
import { EventEmitter } from 'events'
import { ServerMode, ServerOptions } from './types'
import { Router } from './router'
import { Website } from './types'

export class Server extends EventEmitter {
  private httpServer: HttpServer | null = null
  private port: number
  private mode: ServerMode
  public router: Router

  constructor(options: ServerOptions, websites: Website[]) {
    super()
    this.port = options.port || 3000
    this.mode = options.mode || 'development'

    this.router = new Router(websites)
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const website = this.router.getWebsite(req.url || '/')
    if (website) {
      website.handleRequest(req, res)
    } else {
      res.writeHead(404)
      res.end('Not Found')
    }
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

}
