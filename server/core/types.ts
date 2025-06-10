import { IncomingMessage, ServerResponse } from 'http'
import { Socket } from 'socket.io'
import { Model, ModelStatic, Sequelize } from 'sequelize'
import * as Handlebars from 'handlebars'
import { DatabaseInstance } from './database'
import { User } from './security'

export namespace Thalia {
  // Database Types
  export interface SequelizeWrapper {
    [key: string]: ModelStatic<Model> | Sequelize
    sequelize: Sequelize
  }

  // Socket Types
  export interface SocketHandler {
    (socket: Socket, data: any, database?: SequelizeWrapper): Promise<void> | void
  }

  export interface SocketEmitter {
    (socket: Socket, database?: SequelizeWrapper): Promise<void> | void
  }

  export interface SocketReceiver {
    name: string
    callback: SocketHandler
  }

  export interface Sockets {
    on: SocketReceiver[]
    emit: SocketEmitter[]
  }

  // Proxy Types
  export interface Proxy {
    host?: string
    filter?: string
    message?: string
    port?: number
    password?: string
    silent?: boolean
  }

  export interface Proxies {
    [key: string]: Proxy
  }

  export interface RawProxy {
    host?: string
    domains?: string[]
    filter?: string
    message?: string
    port?: number
    password?: string
    silent?: boolean
  }

  // Service Types
  export interface Service {
    (
      response: ServerResponse,
      request: IncomingMessage,
      db: SequelizeWrapper,
      words: string[]
    ): Promise<void> | void
  }

  export interface Services {
    login?: Service
    [key: string]: Service
  }

  // Controller Types
  export interface Cookie {
    [key: string]: string
  }

  export interface Controller {
    res: {
      getCookie: (cookieName: string) => string
      setCookie: (cookie: Cookie, expires?: Date) => void
      deleteCookie: (cookieName: string) => void
      end: (result: any) => void
    }
    req: IncomingMessage
    response: ServerResponse
    request: IncomingMessage
    routeFile: (file: string) => void
    ip: string
    db?: SequelizeWrapper | null
    views?: {
      [key: string]: string
    }
    handlebars: typeof Handlebars
    workspacePath?: string
    readAllViews: (callback: ViewCallback) => void
    name: string
    readTemplate?: (config: { template: string; content: string; callback: any }) => void
    path?: string
    query?: any
    cookies?: Cookie
  }

  export interface Controllers {
    [key: string]: (controller: Controller) => Promise<void> | void
  }

  // Website Types
  export interface WebsiteConfig {
    data?: string
    dist?: string
    sockets?: Sockets
    cache?: boolean
    folder?: string
    workspacePath?: string
    domains?: string[]
    services?: Services
    controllers?: Controllers
    standAlone?: boolean
    mustacheIgnore?: string[]
    publish?: {
      [key: string]: string[]
    }
    pages?: {
      [key: string]: string
    }
    redirects?: {
      [key: string]: string
    }
    proxies?: Proxies | RawProxy[]
    security?: {
      loginNeeded: (req: IncomingMessage) => boolean
    }
    views?: any
    viewableFolders?: boolean | string[]
    seq?: SequelizeWrapper
    readAllViews?: (callback: ViewCallback) => void
    readTemplate?: (config: { template: string; content: string; callback: any }) => void
  }

  // Router Types
  export interface Router {
    (
      site: Website,
      pathname: string,
      response: ServerResponse,
      request: IncomingMessage
    ): Promise<void> | void
  }

  // View Types
  export interface Views {
    [key: string]: string
  }

  export type ViewCallback = (views: Views) => void

  // Server Types
  export interface ServerOptions {
    port?: number
    defaultProject?: string
    rootPath?: string
    blacklist?: string[]
  }

  // Website Class Interface
  export interface Website {
    readonly name: string
    readonly config: WebsiteConfig
    readonly rootPath: string
    
    loadViews(): Promise<void>
    renderTemplate(template: string, data: any): Promise<string>
    getProxyForHost(host: string): Proxy | null
    getControllerForPath(path: string): ((controller: Controller) => Promise<void> | void) | null
    getServiceForPath(path: string): Service | null
  }
}

export type Views = {
  [key: string]: string
}

export type Thalia = {
  Controller: {
    new (
      req: IncomingMessage,
      res: ServerResponse,
      website: Website,
      db: DatabaseInstance,
      handlebars: any
    ): Controller
  }
}

export type Controller = {
  req: IncomingMessage
  res: ServerResponse
  website: Website
  db: DatabaseInstance
  handlebars: any
  path: string[]
  readAllViews: (callback: (views: Views) => void) => void
  setCookie: (name: string, value: string, expires?: Date) => void
  getCookie: (name: string) => string
  deleteCookie: (name: string) => void
}

export type Website = {
  config: {
    name: string
    folder: string
    domains: string[]
    controllers: {
      [key: string]: (controller: Controller) => void
    }
    services: {
      [key: string]: (res: ServerResponse, req: IncomingMessage, db: DatabaseInstance, words: string[]) => void
    }
    sockets: {
      on: {
        name: string
        callback: (socket: Socket, data: any) => void
      }[]
      emit: ((socket: Socket) => void)[]
    }
  }
} 