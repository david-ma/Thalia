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

    export type Website = any;
    export type Proxy = any;

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
            (site:Website, config: any, cred:any) :void;
        }
    }


    export interface sockets {
        
        sockets: {
            on :Array<Receiver>,
            emit :Array<Emitter>
        }
    }
}

