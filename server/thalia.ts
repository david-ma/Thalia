import { Server } from './server.js'
import { ServerOptions } from './types.js'

export interface Thalia {
  start(): Promise<void>
  stop(): Promise<void>
  getServer(): Server
}

export interface ThaliaConstructor {
  new (options: ServerOptions): Thalia
} 