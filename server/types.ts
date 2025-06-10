import { IncomingMessage, ServerResponse } from 'http'

// Server Types
export type ServerMode = 'standalone' | 'multiplex' | 'dev'

export interface ServerOptions {
  project: string
  port: number
  mode: ServerMode
  rootPath: string
}

// Website Types
export interface WebsiteConfig {
  name: string
  rootPath: string
}

export interface Website {
  readonly name: string
  readonly config: WebsiteConfig
  readonly rootPath: string
  handleRequest(req: IncomingMessage, res: ServerResponse): void
} 