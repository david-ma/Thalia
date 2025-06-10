"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Thalia = void 0;
const path = require("path");
const fs = require("fs");
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
        this.server.on('request', async (req, res) => {
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            const words = url.pathname.split('/').filter(Boolean);
            const websiteName = words[0];
            if (this.websites.has(websiteName)) {
                const website = this.websites.get(websiteName);
                const remainingPath = '/' + words.slice(1).join('/');
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
                if (website.config.controllers) {
                    for (const [path, controller] of Object.entries(website.config.controllers)) {
                        if (remainingPath === path) {
                            await this.handlers.handleControllerRequest(controller, website, req, res);
                            return;
                        }
                    }
                }
                if (website.config.services) {
                    for (const [path, service] of Object.entries(website.config.services)) {
                        if (remainingPath.startsWith(path)) {
                            await this.handlers.handleServiceRequest(service, website, req, res);
                            return;
                        }
                    }
                }
                await this.handlers.handleStaticRequest(website, remainingPath, req, res);
            }
            else {
                res.writeHead(404);
                res.end('Website not found');
            }
        });
        this.server.on('connection', (socket) => {
            const website = this.server.getWebsiteForSocket(socket);
            if (website) {
                socket.on('message', (data) => {
                });
            }
        });
        await this.server.start(port);
        console.log(`Server started on port ${port}`);
        console.log('Available websites:', Array.from(this.websites.keys()).join(', '));
    }
    stop() {
        this.server.stop();
    }
}
exports.Thalia = Thalia;
