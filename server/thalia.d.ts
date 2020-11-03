import { IncomingMessage, ServerResponse } from 'http'
import { Website as requestHandlersWebsite } from './requestHandlers'
import SocketIO = require('socket.io')
// https://www.typescriptlang.org/docs/handbook/declaration-files/templates/module-class-d-ts.html

export declare namespace Thalia {

    export interface Emitter {
        (socket :SocketIO.Socket, database :any) :any;
    }
    export interface Receiver {
        name:string;
        callback: {
            (socket :SocketIO.Socket, data:any, database :any) :any;
        }
    }

    export type MysqlWrapper = unknown;
    export type SequelizeWrapper = any;
    export type Proxy = any;
    export class Website extends requestHandlersWebsite { }

    export interface Sockets {
      on :Array<Receiver>,
      emit :Array<Emitter>
    }

    export interface Service {
        (response: ServerResponse, request: IncomingMessage, db: Thalia.SequelizeWrapper, words: any): void;
    }
    export interface Services {
        login ?: any;
        [key:string] : Service;
    }

    export interface Controller {
      res: ServerResponse | {
          end: (result: any) => void;
      };
      req ?: IncomingMessage;
      db ?: SequelizeWrapper | null;
      views ?: any;
      readAllViews ?: any;
      readTemplate ?: any;
      path ?: any;
    }

    export interface Controllers {
        [key:string] : {
            (responder : Controller) : void;
        }
    }

    export interface WebsiteConfig {
      data ?: string;
      dist ?: string;
      sockets ?: Sockets;
      cache ?: boolean;
      folder ?: string;
      domains ?: Array<string>;
      services ?: Services;
      controllers ?: Controllers;
      standAlone ?: boolean;
      mustacheIgnore ?: Array<string>;
      pages ?: {
          [key:string] : string;
      };
      redirects ?: {
          [key:string] : string;
      };
      proxies ?: {
          [key:string] : Proxy;
      };
      security ?: {
          loginNeeded: any;
      };
      views ?: any;
      viewableFolders ?: boolean | Array<any>;
      seq ?: SequelizeWrapper;
      readAllViews ?: {
          (callback: any) :void;
      };
      readTemplate ?: {
          (template: string, content: string, callback: any) :void;
      };
  }
    export interface WebsiteCredentials { }

    export interface Router {
        (site :Website, pathname :string, response :ServerResponse, request :IncomingMessage) :void;
    }

    export interface Handle {
        websites: {
            [key:string]: Website;
        };
        index: {
            localhost :string;
            [key:string]: string;
        };
        proxies: {
            [key:string] :Proxy;
        }

        loadAllWebsites: { () :void; };
        getWebsite: {
            (host:string) :Website;
        };
        addWebsite: {
            (site:string, config: any) :void;
        }
    }

    export interface RouteData {
        cookies : {
            [key:string]: string;
        };
        words : Array<string>;
    }

}
