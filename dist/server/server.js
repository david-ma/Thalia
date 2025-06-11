/**
 * Thalia server.
 *
 * Class which allows initialisation of a server.
 */
import { createServer } from 'http';
import { EventEmitter } from 'events';
import { Router } from './router';
export class Server extends EventEmitter {
    constructor(options, websites) {
        super();
        this.httpServer = null;
        this.port = options.port || 3000;
        this.mode = options.mode || 'development';
        this.project = options.project || 'default';
        this.router = new Router(websites);
    }
    handleRequest(req, res) {
        const domain = req.headers.host?.split(':')[0];
        const website = this.router.getWebsite(domain || this.project);
        if (website) {
            website.handleRequest(req, res);
        }
        else {
            res.writeHead(404);
            res.end('No website Found');
        }
    }
    async start() {
        return new Promise((resolve) => {
            this.httpServer = createServer(this.handleRequest.bind(this));
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
//# sourceMappingURL=server.js.map