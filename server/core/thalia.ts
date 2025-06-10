import { ThaliaServer } from '../server'
import { ServerOptions } from './types'

export interface Thalia {
  start(): Promise<void>
  stop(): Promise<void>
  getServer(): ThaliaServer
}

export interface ThaliaConstructor {
  new (options: ServerOptions): Thalia
} 