/**
 * Thalia server.
 *
 * Class which allows initialisation of a server.
 */

import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from 'http'
import { EventEmitter } from 'events'
import { ServerMode, ServerOptions, ClientInfo } from './types'
import { Router } from './router'
import { Website } from './website'
import url from 'url'
import { Server as SocketServer } from 'socket.io'
import { Socket } from 'socket.io'
import { RequestHandler } from './request-handler'
import { UserAuth, Permission } from './route-guard'

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
  cookies: Record<string, string>
  userAuth?: UserAuth
  permissions?: Permission[]
  version?: Record<string, string>
  node_env: string
  query: Record<string, string>
}

export class Server extends EventEmitter {
  private httpServer!: HttpServer
  private socketServer!: SocketServer
  /** Track open TCP sockets so we can force-close them on stop() (keep-alive can otherwise hang httpServer.close). */
  private httpSockets: Set<import('net').Socket> = new Set()
  private port: number
  private mode: ServerMode
  private nodeEnv: string
  public router: Router
  private project: string

  constructor(options: ServerOptions, websites: Website[]) {
    super()
    this.port = options.port || 3000
    this.mode = options.mode || 'development'
    this.nodeEnv = options.node_env || 'development'
    this.project = options.project || 'default'

    this.router = new Router(websites)
  }

  private logRequest(req: IncomingMessage): RequestInfo {
    // Prefer X-Forwarded-Host when behind nginx/proxy so route guard sees the original host (e.g. mistral.david-ma.net)
    const host: string =
      (req.headers['x-forwarded-host'] as string) ??
      (req.headers['x-host'] as string) ??
      req.headers.host ??
      'unknown-host'
    const domain: string = host.split(':')[0] ?? 'unknown-domain'
    const urlObject: url.UrlWithParsedQuery = url.parse(req.url ?? '', true)
    const ip: string =
      (req.headers['true-client-ip'] as string) ??
      (req.headers['cf-connecting-ip'] as string) ??
      (req.headers['x-real-ip'] as string) ??
      (req.headers['x-forwarded-for'] as string) ??
      req.socket.remoteAddress ??
      'unknown-ip'
    const method: string = req.method ?? 'unknown-method'

    console.log(`${new Date().toISOString()} ${ip} ${method} ${host}${urlObject.href ?? 'unknown-url'}`)

    // Normalise trailing slashes but preserve the root path as "/".
    const rawPathname = urlObject.pathname ?? '/'
    const pathname = rawPathname === '/' ? '/' : rawPathname.replace(/\/$/, '')
    const parts = pathname.split('/')
    // Added this for smgumug 2026-02-25 to handle the homepage controller
    // See line 255 in website.ts
    // This might break older websites that use '' as the homepage controller
    // Needs testing
    const controller = (pathname === '/' || pathname === '') ? 'homepage' : (parts[1] ?? '')
    const action = parts[2] ?? ''
    const slug = parts.pop() ?? ''
    const cookies = this.parseCookies(req)

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
      cookies,
      node_env: this.nodeEnv,
      query: urlObject.query as Record<string, string>,
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
      new RequestHandler(website).handleRequest(req, res, requestInfo)
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
        (socket.handshake.headers['true-client-ip'] as string) ??
        (socket.handshake.headers['cf-connecting-ip'] as string) ??
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

      // Track sockets to make shutdown deterministic in tests.
      this.httpServer.on('connection', (socket) => {
        this.httpSockets.add(socket)
        socket.on('close', () => {
          this.httpSockets.delete(socket)
        })
      })

      this.httpServer.listen(this.port, () => {
        console.log(`Server running at http://localhost:${this.port}`)
        this.emit('started')
        resolve()
      })
    })
  }

  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.httpServer || !this.httpServer.listening) {
        resolve()
        return
      }

      if (this.socketServer && typeof this.socketServer.close === 'function') {
        // Close Socket.IO first (best effort; callback-style).
        try {
          this.socketServer.close()
        } catch {
          /* ignore */
        }
      }

      const httpServer = this.httpServer
      this.socketServer = {} as SocketServer
      this.httpServer = {} as HttpServer

      // Force-close keep-alive sockets so httpServer.close() doesn't hang.
      for (const socket of this.httpSockets) {
        try {
          socket.destroy()
        } catch {
          /* ignore */
        }
      }
      this.httpSockets.clear()

      // Bun/Node: close every active connection so httpServer.close() resolves promptly in tests.
      httpServer.closeIdleConnections?.()
      httpServer.closeAllConnections?.()

      httpServer.close((err) => {
        // Bun/Node: close() may error if the listener is already closed; shutdown should remain idempotent.
        if (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (/not\s+running|already\s+closed|Server\s+is\s+not\s+running/i.test(msg)) {
            this.emit('stopped')
            resolve()
            return
          }
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

  private parseCookies(req: IncomingMessage): Record<string, string> {
    const cookies: Record<string, string> = {}
    const cookieHeader = req.headers.cookie

    if (cookieHeader) {
      cookieHeader.split(';').forEach((cookie) => {
        const [name, value] = cookie.trim().split('=')
        if (name && value) {
          cookies[name] = value
        }
      })
    }

    return cookies
  }
}
