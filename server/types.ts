import { IncomingMessage, ServerResponse } from 'http'

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
export interface WebsiteConfig {
  name: string
  rootPath: string
  domains?: string[]
  controllers?: { [key: string]: any }
  routes?: RouteRule[]    // List of route rules
}

export interface Website {
  readonly name: string
  readonly config: WebsiteConfig
  readonly rootPath: string
  handleRequest(req: IncomingMessage, res: ServerResponse): void
} 