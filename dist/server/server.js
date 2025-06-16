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
     * Find the website for the socket and call its handleSocketConnection method.
     * Insert security here?
     */
    handleSocketConnection(socket) {
        const domain = socket.handshake.headers.host?.split(':')[0];
        const website = this.router.getWebsite(domain ?? this.project);
        const clientInfo = {
            socketId: socket.id,
            ip: socket.handshake.headers['x-real-ip'] ?? socket.handshake.headers['x-forwarded-for'] ?? socket.handshake.address,
            userAgent: socket.handshake.headers['user-agent'] ?? 'unknown',
            cookies: socket.handshake.headers['cookie'] ?? 'unknown',
            domain: domain ?? this.project,
            timestamp: new Date().toISOString()
        };
        if (website) {
            website.handleSocketConnection(socket, clientInfo);
        }
        else {
            console.log('No website found for socket connection', clientInfo);
        }
    }
    static createSocketServer(httpServer, handleSocketConnection) {
        return new SocketServer(httpServer, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        })
            .on('connection', handleSocketConnection)
            .on('error', (error) => {
            console.error('Socket server error:', error);
        });
    }
    async start() {
        return new Promise((resolve) => {
            this.httpServer = createServer(this.handleRequest.bind(this));
            this.socketServer = Server.createSocketServer(this.httpServer, this.handleSocketConnection.bind(this));
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