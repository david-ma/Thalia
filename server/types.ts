import { IncomingMessage, ServerResponse } from 'http'
import { Controller } from './website.js'
import { Socket } from 'socket.io'
import { RequestInfo } from './server.js'
import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'

// import { type TSchema } from 'drizzle-orm'
// import { PgTableWithColumns } from 'drizzle-orm/pg-core'

// Server Types
export type ServerMode = 'standalone' | 'multiplex' | 'development'

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
  socketId: string
  ip: string
  userAgent: string
  cookies: string
  domain: string
  timestamp: string
}

export type RawWebsocketConfig = {
  listeners?: { [key: string]: (socket: Socket, data: any, clientInfo: ClientInfo) => void }
  onSocketConnection?: (socket: Socket, clientInfo: ClientInfo) => void
  onSocketDisconnect?: (socket: Socket, clientInfo: ClientInfo) => void
}

export interface WebsocketConfig extends RawWebsocketConfig {
  listeners: { [key: string]: (socket: Socket, data: any, clientInfo: ClientInfo) => void }
  onSocketConnection: (socket: Socket, clientInfo: ClientInfo) => void
  onSocketDisconnect: (socket: Socket, clientInfo: ClientInfo) => void
}

export interface BasicWebsiteConfig {
  name: string
  rootPath: string
}

import { CrudMachine } from './controllers.js'

// Use SQLiteTableWithColumns for now, but we will add PgTableWithColumns later
// export type DatabaseTable = SQLiteTableWithColumns<any> | PgTableWithColumns<any>
// export type DatabaseTable = SQLiteTableWithColumns<any>
export interface DatabaseConfig {
  // schemas: any
  schemas: {
    [key: string]: SQLiteTableWithColumns<any>
  //   // [key: string]: SQLiteTableWithColumns<any> | SQLiteTable<any> | any
    // [key: string]: any
  },
  machines?: {
    [key: string]: CrudMachine
  }
}

export interface RawWebsiteConfig {
  domains?: string[]
  controllers?: { [key: string]: Controller }
  routes?: RouteRule[]
  websockets?: RawWebsocketConfig
  database?: DatabaseConfig
}

export interface WebsiteConfig extends BasicWebsiteConfig, RawWebsiteConfig {
  name: string
  rootPath: string
  domains: string[]
  controllers: { [key: string]: Controller }
  routes: RouteRule[]
  websockets: WebsocketConfig
}

export interface WebsiteInterface {
  readonly name: string
  readonly config: WebsiteConfig
  readonly rootPath: string
  handleRequest(req: IncomingMessage, res: ServerResponse, requestInfo: RequestInfo, pathname?: string): void
  handleSocketConnection(socket: Socket, clientInfo: ClientInfo): void
}
