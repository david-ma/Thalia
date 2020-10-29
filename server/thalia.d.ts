import { any } from "bluebird";
import { Sequelize } from "sequelize/types";


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

    export type Proxy = any;
    export class Website {
        name: string;
        data: boolean | string;
        dist: boolean | string;
        cache: boolean;
        folder: string;
        domains: Array<string>;
        pages: {};
        redirects: object;
        services: {};
        proxies: {
            [key:string] : Proxy;
        };
        sockets: Sockets;
        security: {};
        viewableFolders: boolean;
        db: any;
        seq: any;
        readAllViews :{
            (callback: any) :void;
        };
        readTemplate :{
            (template: string, content: string, callback: any) :void;
        };
        views: any;
        controllers: {
            [key:string] : any;
        }
    }

    export interface WebsiteConfig {
        standAlone ?: boolean;
        mustacheIgnore ?: Array<string>;
    }

    export interface WebsiteCredentials { }

    export interface handle {
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

