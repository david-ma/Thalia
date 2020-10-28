
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


    export interface handle {
        websites: Array<any>;
        getWebsite: {
            (host:string) :any;
        };
    }


    export interface sockets {
        
        sockets: {
            on :Array<Receiver>,
            emit :Array<Emitter>
        }
    }
}

