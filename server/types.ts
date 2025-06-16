import { IncomingMessage, ServerResponse } from 'http'
import { Controller } from './website.js'
import { Socket } from 'socket.io'

// Server Types
export type ServerMode = 'standalone' | 'multiplex' | 'dev'

export interface ServerOptions {
  project: string
  port: number
  mode: ServerMode
  rootPath: string
}

// Security Types
export interface BasicAuthConfig {
  enabled: boolean
  password: string
  cookieName?: string
  cookieOptions?: {
    maxAge?: number
    secure?: boolean
    httpOnly?: boolean
  }
}

export interface PathSecurity {
  path: string
  type: 'basic' | 'none'
  password?: string
  allowedPaths?: string[]
}

// Route Types
export interface RouteRule {
  domains: string[]        // Which domains this rule applies to
  path?: string            // The subpath to match (e.g., '/api' or '/admin')
  password?: string       // If set, requires this password
  target?: {              // Optional proxy target
    host: string
    port: number
  }
}

// Website Types
export interface ClientInfo {
  ip: string
  userAgent: string
  cookies: string
}

export interface WebsocketConfig {
  listeners?: { [key: string]: (socket: Socket, clientInfo: ClientInfo) => void }
  onSocketConnection?: (socket: Socket, clientInfo: ClientInfo) => void
  onSocketDisconnect?: (socket: Socket, clientInfo: ClientInfo) => void
}

export interface BasicWebsiteConfig {
  name: string
  rootPath: string
}

export interface RawWebsiteConfig {
  domains?: string[]
  controllers?: { [key: string]: Controller }
  routes?: RouteRule[]
  websockets?: WebsocketConfig
}

export interface WebsiteConfig extends BasicWebsiteConfig, RawWebsiteConfig {
  name: string
  rootPath: string
  domains: string[]
  controllers: { [key: string]: Controller }
  routes: RouteRule[]
  websockets: WebsocketConfig
}

export interface Website {
  readonly name: string
  readonly config: WebsiteConfig
  readonly rootPath: string
  handleRequest(req: IncomingMessage, res: ServerResponse): void
  handleSocketConnection(socket: Socket): void
}
