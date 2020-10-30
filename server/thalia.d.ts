import { IncomingMessage, ServerResponse } from "http";

// https://www.typescriptlang.org/docs/handbook/declaration-files/templates/module-class-d-ts.html

import { Website as requestHandlersWebsite } from "./requestHandlers";

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

    export type MysqlWrapper = any;
    export type SequelizeWrapper = any;
    export type Proxy = any;
    export class Website extends requestHandlersWebsite { }

    export interface WebsiteConfig {
        
        data    ?: string;
        dist    ?: string;
        sockets ?: Sockets;
        cache   ?: boolean;
        folder  ?: string;
        domains ?: Array<string>;
        services ?: Services;
        controllers ?: Controllers;
        standAlone ?: boolean;
        mustacheIgnore ?: Array<string>;
        pages ?: {
            [key:string] : string;
        };
        redirects   ?: {
            [key:string] : string;
        };
        proxies ?: {
            [key:string] : Proxy;
        };
        sockets ?: Sockets;
        security    ?: {
            loginNeeded: any;
        };
        viewableFolders ?: boolean | Array<any>;
        db  ?: MysqlWrapper;
        seq ?: SequelizeWrapper;
        readAllViews ?: {
            (callback: any) :void;
        };
        readTemplate ?: {
            (template: string, content: string, callback: any) :void;
        };
        views   ?: any;
    }

    export interface Services {
        login ?: any;
        [key:string] :
            (response: ServerResponse, request: IncomingMessage, db: Thalia.MysqlWrapper | Thalia.SequelizeWrapper, words: any) => void
    }

    export interface Controllers {
        [key:string] : {
            (responder : Controller) : void;
        }
    }

    export interface WebsiteCredentials { }

    export interface Router {
        (site :Website, pathname :string, response :ServerResponse, request :IncomingMessage)
    }

    export interface Controller {
        res: ServerResponse | {
            end: (result: any) => void;
        };
        req ?: IncomingMessage;
        db ?: MysqlWrapper | SequelizeWrapper | null;
        views ?: any;
        readAllViews ?: any;
        readTemplate ?: any;
        path ?: any;
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
            (site:string, config: any, cred:any) :void;
        }
    }


    export interface Sockets {
        on :Array<Receiver>,
        emit :Array<Emitter>
    }
}

