import type { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
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
  /** When set, `password` is enforced only in this environment (`RequestInfo.node_env`). */
  node_env?: string
  /** Comma-separated IPv4 addresses or CIDR blocks (e.g. `192.168.0.0/24`) that skip `password`. */
  ip_whitelist?: string
  path_whitelist?: string[] // List of paths that are whitelisted from password protection
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

/** Readiness for a Machine after `init` / for future gated `/health`. */
export type MachineStatus = 'ok' | 'degraded' | 'error'

/**
 * Cheap, non-sensitive machine readiness snapshot.
 * `durationMs` is attached by {@link DatabaseInitReport}, not by `health()` itself.
 */
export type MachineReport = {
  name: string
  status: MachineStatus
  /** Short note safe for logs — never secrets or connection strings */
  detail?: string
  /** When status is `error` (or degraded with a hard cause) */
  error?: string
}

/** One machine’s boot result including orchestrator-measured duration. */
export type MachineInitEntry = MachineReport & { durationMs: number }

/** Aggregate from `ThaliaDatabase.init` machine phase (smoke / trend baselines). */
export type DatabaseInitReport = {
  website: string
  /** Wall time of `Promise.all` (parallel), not sum of durations */
  wallMs: number
  machines: MachineInitEntry[]
}

/**
 * A Machine is a singleton that needs to be initialised by Thalia.
 * They provide controllers. CrudFactories are Machines; ThaliaImageUploader is a Machine.
 *
 * `init` must finish required setup then `return this.health()`.
 * `health` is cheap, read-only, and idempotent (safe to call again later).
 */
export type Machine = {
  init: (website: Website, name: string) => Promise<MachineReport>
  health: () => Promise<MachineReport>
  controller: Controller
  table: MySqlTableWithColumns<any>
}

// Use SQLiteTableWithColumns for now, but we will add PgTableWithColumns later
// export type DatabaseTable = SQLiteTableWithColumns<any> | PgTableWithColumns<any>
// export type DatabaseTable = SQLiteTableWithColumns<any>
export interface DatabaseConfig {
  schemas: Record<string, any>
  machines?: Record<string, Machine>
}

import { SecurityConfig, type RoleRouteRule } from './route-guard.js'
export type { SecurityConfig, RoleRouteRule }

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

/** Options for `ThaliaSecurity` + `RoleRouteGuard` (sessions, signup, bootstrap). */
export type ThaliaAuthOptions = {
  /** When true, omit `newUser` / `createNewUser` controllers and drop them from the auth allow-path list */
  disableSelfRegistration?: boolean
  /**
   * When true, hide the “Forgot password?” link on the login page.
   * Prefer this over trying to detect a working mail transport (mail init is async and may fail later).
   */
  disablePasswordReset?: boolean
  /** Cookie + DB `sessions.expires` TTL (seconds). Default 7 days */
  sessionMaxAgeSeconds?: number
}

/**
 * Optional SmugMug machine settings (`ThaliaImageUploader`).
 * Precedence: `config/secrets.js` `smugmug` fields override these when set.
 *
 * For local OAuth, the callback URL must match what SmugMug redirects to; use a tunnel
 * (e.g. **ngrok**, Cloudflare Tunnel) and set `oauthCallbackUrl` or `SMUGMUG_OAUTH_CALLBACK_URL`.
 */
export type SmugMugSiteOptions = {
  oauthCallbackUrl?: string
  /**
   * Default album target for uploads: bare **album key**, `/api/v2/album/{key}`, or API URL
   * `https://api.smugmug.com/api/v2/album/{key}` (gallery page URLs are not accepted).
   */
  album?: string
}

export interface RawWebsiteConfig {
  domains?: string[]
  controllers?: Record<string, NestedControllerMap>
  routes?: RouteRule[] | RoleRouteRule[]
  websockets?: RawWebsocketConfig
  database?: DatabaseConfig
  security?: SecurityConfig
  /** Thalia security module settings (sessions, signup, bootstrap) */
  thaliaAuth?: ThaliaAuthOptions
  handlebarsHelpers?: Record<string, (...args: any[]) => any>
  sitemap?: SitemapConfig
  /** SmugMug upload OAuth: callback URL + default album (secrets still win where present). */
  smugmug?: SmugMugSiteOptions
}

export interface WebsiteConfig extends BasicWebsiteConfig, RawWebsiteConfig {
  name: string
  rootPath: string
  domains: string[]
  controllers: Record<string, NestedControllerMap>
  routes: RouteRule[]
  websockets: WebsocketConfig
}
