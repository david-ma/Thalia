/**
 * Thalia server.
 *
 * Class which allows initialisation of a server.
 */
import { createServer } from 'http';
import { EventEmitter } from 'events';
import { Router } from './router.js';
import url from 'url';
import { Server as SocketServer } from 'socket.io';
export class Server extends EventEmitter {
    constructor(options, websites) {
        super();
        this.port = options.port || 3000;
        this.mode = options.mode || 'development';
        this.project = options.project || 'default';
        this.router = new Router(websites);
    }
    logRequest(req) {
        const host = req.headers['x-host'] ?? req.headers.host;
        const urlObject = url.parse(req.url ?? '', true);
        const ip = req.headers['x-real-ip'] ?? req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown';
        const method = req.method ?? 'unknown';
        console.log(`${new Date().toISOString()} ${ip} ${method} ${host}${urlObject.href}`);
    }
    /**
     * Handle HTTP requests.
     */
    handleRequest(req, res) {
        this.logRequest(req);
        const domain = req.headers.host?.split(':')[0];
        const website = this.router.getWebsite(domain ?? this.project);
        if (website) {
            website.handleRequest(req, res);
        }
        else {
            res.writeHead(404);
            res.end('No website Found');
        }
    }
    /**
     * Handle socket connections.
     * listener: (socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) => void): SocketServer<...>
  
  
    Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>
     */
    handleSocketConnection(socket) {
        console.log("sever.ts has seen a socket connection?");
        console.log('Socket connected');
        socket.on('hello', (data) => {
            console.log('Hello received:', data);
            socket.emit('handshake', 'We received your hello');
        });
    }
    static createSocketServer(httpServer, handleSocketConnection) {
        return new SocketServer(httpServer, {
        // cors: {
        //   origin: "*",
        //   methods: ["GET", "POST"]
        // }
        })
            .on('connection', handleSocketConnection)
            .on('error', (error) => {
            console.error('Socket server error:', error);
        });
    }
    async start() {
        return new Promise((resolve) => {
            this.httpServer = createServer(this.handleRequest.bind(this));
            this.socketServer = Server.createSocketServer(this.httpServer, this.handleSocketConnection);
            this.httpServer.listen(this.port, () => {
                console.log(`Server running at http://localhost:${this.port}`);
                this.emit('started');
                resolve();
            });
        });
    }
    async stop() {
        return new Promise((resolve, reject) => {
            if (!this.httpServer) {
                resolve();
                return;
            }
            this.socketServer.close();
            this.socketServer = {};
            this.httpServer = {};
            this.httpServer.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                this.emit('stopped');
                resolve();
            });
        });
    }
    getMode() {
        return this.mode;
    }
    getPort() {
        return this.port;
    }
}
//# sourceMappingURL=server.js.map