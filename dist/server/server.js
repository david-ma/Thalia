"use strict";
/**
 * Thalia server.
 *
 * Class which allows initialisation of a server.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
const http_1 = require("http");
const events_1 = require("events");
const router_1 = require("./router");
class Server extends events_1.EventEmitter {
    constructor(options, websites) {
        super();
        this.httpServer = null;
        this.port = options.port || 3000;
        this.mode = options.mode || 'development';
        this.router = new router_1.Router(websites);
    }
    handleRequest(req, res) {
        const website = this.router.getWebsite(req.url || '/');
        if (website) {
            website.handleRequest(req, res);
        }
        else {
            res.writeHead(404);
            res.end('Not Found');
        }
    }
    async start() {
        return new Promise((resolve) => {
            this.httpServer = (0, http_1.createServer)(this.handleRequest.bind(this));
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
            this.httpServer.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                this.httpServer = null;
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
exports.Server = Server;
//# sourceMappingURL=server.js.map