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
        standAlone ?: boolean;
        mustacheIgnore ?: Array<string>;
    }

    export interface WebsiteCredentials { }

    export interface Router {
        (site :Website, pathname :string, response :ServerResponse, request :IncomingMessage)
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
    export interface WebsiteConfig {
        sockets ?: Thalia.Sockets
    }
}

