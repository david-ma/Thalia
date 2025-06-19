/**
 * Thalia server.
 *
 * Class which allows initialisation of a server.
 */

import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from 'http'
import { EventEmitter } from 'events'
import { ServerMode, ServerOptions, ClientInfo } from './types.js'
import { Router } from './router.js'
import { Website } from './website.js'
import url from 'url'
import { Server as SocketServer } from 'socket.io'
import { Socket } from 'socket.io'

export type RequestInfo = {
  host: string
  domain: string
  url: string
  ip: string
  method: string
  pathname: string
  controller: string
  action: string
  slug: string
}

export class Server extends EventEmitter {
  private httpServer!: HttpServer
  private socketServer!: SocketServer
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

  private logRequest(req: IncomingMessage): RequestInfo {
    const host: string = (req.headers['x-host'] as string) ?? req.headers.host
    const domain: string = host.split(':')[0]
    const urlObject: url.UrlWithParsedQuery = url.parse(req.url ?? '', true)
    const ip: string =
      (req.headers['x-real-ip'] as string) ??
      (req.headers['x-forwarded-for'] as string) ??
      req.socket.remoteAddress ??
      'unknown'
    const method: string = req.method ?? 'unknown'

    console.log(`${new Date().toISOString()} ${ip} ${method} ${host}${urlObject.href}`)

    const pathname = urlObject.pathname ?? '/'
    const parts = pathname.split('/')
    const controller = parts[1] ?? ''
    const action = parts[2] ?? ''
    const slug = parts.pop() ?? ''

    return {
      host,
      domain,
      url: urlObject.href,
      ip,
      method,
      pathname,
      controller,
      action,
      slug,
    }
  }

  /**
   * Handle HTTP requests.
   */
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const requestInfo = this.logRequest(req)

    const domain = req.headers.host?.split(':')[0]
    const website = this.router.getWebsite(domain ?? this.project)

    if (website) {
      website.handleRequest(req, res, requestInfo)
    } else {
      res.writeHead(404)
      res.end('No website Found')
    }
  }

  /**
   * Handle socket connections.
   * Find the website for the socket and call its handleSocketConnection method.
   * Insert security here?
   */
  private handleSocketConnection(socket: Socket): void {
    const domain = socket.handshake.headers.host?.split(':')[0]
    const website = this.router.getWebsite(domain ?? this.project)
    const clientInfo: ClientInfo = {
      socketId: socket.id,
      ip:
        (socket.handshake.headers['x-real-ip'] as string) ??
        (socket.handshake.headers['x-forwarded-for'] as string) ??
        socket.handshake.address,
      userAgent: (socket.handshake.headers['user-agent'] as string) ?? 'unknown',
      cookies: (socket.handshake.headers['cookie'] as string) ?? 'unknown',
      domain: domain ?? this.project,
      timestamp: new Date().toISOString(),
    }

    if (website) {
      website.handleSocketConnection(socket, clientInfo)
    } else {
      console.log('No website found for socket connection', clientInfo)
    }
  }

  private static createSocketServer(
    httpServer: HttpServer,
    handleSocketConnection: (socket: Socket) => void,
  ): SocketServer {
    return new SocketServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    })
      .on('connection', handleSocketConnection)
      .on('error', (error: any) => {
        console.error('Socket server error:', error)
      })
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer = createServer(this.handleRequest.bind(this))
      this.socketServer = Server.createSocketServer(this.httpServer, this.handleSocketConnection.bind(this))

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

      this.socketServer.close()
      this.socketServer = {} as SocketServer
      this.httpServer = {} as HttpServer
      this.httpServer.close((err) => {
        if (err) {
          reject(err)
          return
        }
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
