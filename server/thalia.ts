// // index.ts

import { IncomingMessage, ServerResponse } from 'http'
import { Website as requestHandlersWebsite } from './requestHandlers'
import { ViewCallback } from './requestHandlers'
import SocketIO = require('socket.io')
import Handlebars = require('handlebars')

export declare module Thalia {
  export interface Emitter {
    (socket: SocketIO.Socket, database: any): any
  }
  export interface Receiver {
    name: string
    callback: {
      (socket: SocketIO.Socket, data: any, database: any): any
    }
  }

  export type MysqlWrapper = unknown
  export type SequelizeWrapper = any

  // TODO: This should really be something like this:
  //   export type SequelizeWrapper = {
  //     [key: string]: ModelStatic<Model>
  //     // sequelize: Sequelize
  //   }

  export type Proxy = {
    host?: string
    filter?: string
    message?: string
    port?: number
    password?: string
    silent?: boolean
  }

  export type Proxies = {
    [key: string]: Proxy
  }

  export type rawProxy = {
    host?: string
    domains?: string[]
    filter?: string
    message?: string
    port?: number
    password?: string
    silent?: boolean
  }

  export class Website extends requestHandlersWebsite {}

  export interface Sockets {
    on: Array<Receiver>
    emit: Array<Emitter>
  }

  export interface Service {
    (
      response: ServerResponse,
      request: IncomingMessage,
      db: Thalia.SequelizeWrapper,
      words: any
    ): void
  }
  export interface Services {
    login?: any
    [key: string]: Service
  }

  export interface Controller {
    res: // ServerResponse &
    {
      getCookie: (cookieName: string) => string
      setCookie: (cookie: Cookie, expires?: Date) => void
      deleteCookie: (cookieName: string) => void
      end: (result: any) => void
    }
    req: IncomingMessage
    response: ServerResponse<IncomingMessage>
    request: IncomingMessage
    routeFile: (file: string) => void
    ip: string
    db?: SequelizeWrapper | null
    views?: {
      [key: string]: string
    }
    handlebars: typeof Handlebars
    workspacePath?: any
    readAllViews: (callback: ViewCallback) => void
    name: string
    readTemplate?: any
    path?: any
    query?: any
    cookies?: Cookie
  }

  type Cookie = {
    [key: string]: string
  }

  export interface Controllers {
    [key: string]: {
      (responder: Controller): void
    }
  }

  export interface WebsiteConfig {
    data?: string
    dist?: string
    sockets?: Sockets
    cache?: boolean
    folder?: string
    workspacePath?: string
    domains?: Array<string>
    services?: Services
    controllers?: Controllers
    standAlone?: boolean
    mustacheIgnore?: Array<string>
    publish?: {
      [key: string]: string[]
    }
    pages?: {
      [key: string]: string
    }
    redirects?: {
      [key: string]: string
    }
    proxies?:
      | {
          [key: string]: Proxy
        }
      | rawProxy[]

    security?: {
      loginNeeded: any
    }
    views?: any
    viewableFolders?: boolean | Array<string>
    seq?: SequelizeWrapper
    readAllViews?: {
      (callback: any): void
    }
    readTemplate?: {
      (config: { template: string; content: string; callback: any }): void
    }
  }
  export interface WebsiteCredentials {}

  export interface Router {
    (
      site: Website,
      pathname: string,
      response: ServerResponse,
      request: IncomingMessage
    ): void
  }

  export interface Handle {
    websites: {
      [key: string]: Website
    }
    index: {
      localhost: string
      [key: string]: string
    }
    proxies: {
      [key: string]: Proxies
    }

    loadAllWebsites: { (): void }
    getWebsite: {
      (host: string): Website
    }
    addWebsite: {
      (site: string, config: any): void
    }
  }

  export interface RouteData {
    cookies: {
      [key: string]: string
    }
    words: Array<string>
  }
}
