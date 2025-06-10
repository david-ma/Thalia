"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Thalia = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const server_1 = require("./server");
const website_1 = require("./website");
const handlers_1 = require("./handlers");
class Thalia {
    constructor(options = {}) {
        this.server = new server_1.ThaliaServer(options);
        this.websites = new Map();
        this.handlers = new handlers_1.RequestHandlers();
    }
    async start(port, project) {
        // Load website configurations
        const websitesDir = path.join(__dirname, '..', '..', 'websites');
        const projects = project ? [project] : fs.readdirSync(websitesDir);
        for (const projectName of projects) {
            const projectPath = path.join(websitesDir, projectName);
            if (fs.existsSync(projectPath) && fs.statSync(projectPath).isDirectory()) {
                const configPath = path.join(projectPath, 'config.js');
                if (fs.existsSync(configPath)) {
                    const config = require(configPath).config;
                    this.websites.set(projectName, new website_1.Website(projectName, config, projectPath));
                }
            }
        }
        if (this.websites.size === 0) {
            throw new Error('No valid websites found to serve');
        }
        // Set up request handling
        this.server.on('request', async (req, res) => {
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            const words = url.pathname.split('/').filter(Boolean);
            const websiteName = words[0];
            if (this.websites.has(websiteName)) {
                const website = this.websites.get(websiteName);
                const remainingPath = '/' + words.slice(1).join('/');
                // Handle proxy requests
                if (website.config.proxies) {
                    const proxies = Array.isArray(website.config.proxies)
                        ? website.config.proxies
                        : Object.values(website.config.proxies);
                    for (const proxy of proxies) {
                        if (remainingPath.startsWith(proxy.filter || '')) {
                            await this.handlers.handleProxyRequest(proxy, req, res);
                            return;
                        }
                    }
                }
                // Handle controller requests
                if (website.config.controllers) {
                    for (const [path, controller] of Object.entries(website.config.controllers)) {
                        if (remainingPath === path) {
                            await this.handlers.handleControllerRequest(controller, website, req, res);
                            return;
                        }
                    }
                }
                // Handle service requests
                if (website.config.services) {
                    for (const [path, service] of Object.entries(website.config.services)) {
                        if (remainingPath.startsWith(path)) {
                            await this.handlers.handleServiceRequest(service, website, req, res);
                            return;
                        }
                    }
                }
                // Handle static files
                await this.handlers.handleStaticRequest(website, remainingPath, req, res);
            }
            else {
                res.writeHead(404);
                res.end('Website not found');
            }
        });
        // Set up WebSocket handling
        this.server.on('connection', (socket) => {
            const website = this.server.getWebsiteForSocket(socket);
            if (website) {
                // Handle WebSocket events
                socket.on('message', (data) => {
                    // TODO: Implement WebSocket message handling
                });
            }
        });
        // Start the server
        await this.server.start(port);
        console.log(`Server started on port ${port}`);
        console.log('Available websites:', Array.from(this.websites.keys()).join(', '));
    }
    stop() {
        this.server.stop();
    }
}
exports.Thalia = Thalia;
//# sourceMappingURL=thalia.js.map