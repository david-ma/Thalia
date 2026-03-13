import { Controller, NestedControllerMap, Website } from './website'
import { Socket } from 'socket.io'

// Server Types
export type ServerMode = 'standalone' | 'multiplex' // | 'development'

export interface ServerOptions {
  node_env: string
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
  domains?: string[] // Which domains this rule applies to
  path?: string // The subpath to match (e.g., '/api' or '/admin')
  password?: string // If set, requires this password
  proxyTarget?: {
    // If set, proxy the request to this target
    host?: string // Default: localhost
    port?: number // Default: 80
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

export type WebsocketListener = (socket: Socket, data: any, clientInfo: ClientInfo, website: Website) => void

export type RawWebsocketConfig = {
  listeners?: Record<string, WebsocketListener>
  onSocketConnection?: (socket: Socket, clientInfo: ClientInfo) => void
  onSocketDisconnect?: (socket: Socket, clientInfo: ClientInfo) => void
}

export interface WebsocketConfig extends RawWebsocketConfig {
  listeners: Record<string, WebsocketListener>
  onSocketConnection: (socket: Socket, clientInfo: ClientInfo) => void
  onSocketDisconnect: (socket: Socket, clientInfo: ClientInfo) => void
}

export interface BasicWebsiteConfig {
  name: string
  rootPath: string
  mode: ServerMode
  port: number
}

import { Machine } from './controllers.js'

// Use SQLiteTableWithColumns for now, but we will add PgTableWithColumns later
// export type DatabaseTable = SQLiteTableWithColumns<any> | PgTableWithColumns<any>
// export type DatabaseTable = SQLiteTableWithColumns<any>
export interface DatabaseConfig {
  schemas: Record<string, any>
  machines?: Record<string, Machine>
}

import { SecurityConfig } from './route-guard.js'
export type { SecurityConfig }

import { RoleRouteRule } from './security.js'

/**
 * Sitemap configuration for a website.
 * 
 * A sitemap is a list of URLs that are considered public and should be indexed by search engines.
 * We can make their lives easier by providing a nicely formatted sitemap and siteindex file.
 * 
 * Thalia's generate-sitemap.ts script will crawl the website based on the index.html and generate the sitemap and siteindex files.
 * 
 * However, some pages might not be linked. So we should provide a list of URLs that should be included in the sitemap.
 * We can make categories to give it structure.
 * 
 */
export type SitemapConfig = {
  index: string
  sitemap: string
  categories?: Record<string, SitemapUrl[]>
}

export type SitemapUrl = {
  loc: string
  lastmod?: string
  changefreq?: string
  priority?: number
  image?: string
}

export interface RawWebsiteConfig {
  domains?: string[]
  controllers?: Record<string, NestedControllerMap>
  routes?: RouteRule[] | RoleRouteRule[]
  websockets?: RawWebsocketConfig
  database?: DatabaseConfig
  security?: SecurityConfig
  handlebarsHelpers?: Record<string, (...args: any[]) => any>
  sitemap?: SitemapConfig
}

export interface WebsiteConfig extends BasicWebsiteConfig, RawWebsiteConfig {
  name: string
  rootPath: string
  domains: string[]
  controllers: Record<string, NestedControllerMap>
  routes: RouteRule[]
  websockets: WebsocketConfig
}
