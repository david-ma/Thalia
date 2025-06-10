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
const path_1 = require("path");
const fs_1 = require("fs");
class Server extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.httpServer = null;
        this.port = options.port || 3000;
        this.mode = options.mode || 'development';
        this.rootPath = options.rootPath || process.cwd();
    }
    handleRequest(req, res) {
        // Only handle GET requests for now
        if (req.method !== 'GET') {
            res.writeHead(405);
            res.end('Method Not Allowed');
            return;
        }
        // Get the requested file path
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const path = url.pathname === '/' ? '/index.html' : url.pathname;
        const filePath = (0, path_1.join)(this.rootPath, path);
        // Check if file exists
        if (!(0, fs_1.existsSync)(filePath)) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        // Stream the file
        const stream = (0, fs_1.createReadStream)(filePath);
        stream.on('error', (error) => {
            console.error('Error streaming file:', error);
            res.writeHead(500);
            res.end('Internal Server Error');
        });
        // Set content type based on file extension
        const contentType = this.getContentType(filePath);
        res.setHeader('Content-Type', contentType);
        // Pipe the file to the response
        stream.pipe(res);
    }
    getContentType(filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const contentTypes = {
            'html': 'text/html',
            'css': 'text/css',
            'js': 'text/javascript',
            'json': 'application/json',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'ico': 'image/x-icon',
            'txt': 'text/plain'
        };
        return contentTypes[ext || ''] || 'application/octet-stream';
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
    getRootPath() {
        return this.rootPath;
    }
}
exports.Server = Server;
//# sourceMappingURL=server.js.map