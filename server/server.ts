/**
 * Thalia server.
 * 
 * Class which allows initialisation of a server.
 */

import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from 'http'
import { EventEmitter } from 'events'
import { ServerMode, ServerOptions } from './types.js'
import { Router } from './router.js'
import { Website } from './website.js'
import url from 'url'

export class Server extends EventEmitter {
  private httpServer: HttpServer | null = null
  private port: number
  private mode: ServerMode
  public router: Router
  private project: string

  constructor(options: ServerOptions, websites: Website[]) {
    super()
    this.port = options.port || 3000
    this.mode = options.mode || 'development'
    this.project = options.project || 'default'

    this.router = new Router(websites)
  }

  private getDateTime(): string {
    return new Date().toISOString()
  }

  private logRequest(req: IncomingMessage): void {
    const host: string = (req.headers['x-host'] as string) ?? req.headers.host
    const urlObject: url.UrlWithParsedQuery = url.parse(req.url ?? '', true)
    const ip: string = req.headers['x-forwarded-for'] as string ?? req.socket.remoteAddress ?? 'unknown'
    const method: string = req.method ?? 'unknown'

    console.log(`${this.getDateTime()} ${ip} ${method} ${host}${urlObject.href}`)
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const domain = req.headers.host?.split(':')[0]
    const website = this.router.getWebsite(domain || this.project)

    this.logRequest(req)

    if (website) {
      website.handleRequest(req, res)
    } else {
      res.writeHead(404)
      res.end('No website Found')
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
