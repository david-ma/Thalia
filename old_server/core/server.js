"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThaliaServer = void 0;
const http = require("http");
const path = require("path");
const fs = require("fs");
const events_1 = require("events");
const socket_io_1 = require("socket.io");
const website_1 = require("./website");
class ThaliaServer extends events_1.EventEmitter {
    constructor(options = {}) {
        super();
        this.websites = new Map();
        this.currentProject = options.defaultProject || 'default';
        this.rootPath = options.rootPath || process.cwd();
        this.blacklist = options.blacklist || [];
        this.httpServer = null;
        this.socketServer = null;
    }
    async start(port) {
        await this.loadWebsites();
        this.setupHttpServer(port);
        this.setupSocketServer();
    }
    async stop() {
        if (this.socketServer) {
            this.socketServer.close();
        }
        if (this.httpServer) {
            this.httpServer.close();
        }
    }
    getWebsiteForSocket(socket) {
        const host = socket.handshake.headers.host?.split(':')[0];
        return host ? this.getWebsiteForHost(host) : null;
    }
    async loadWebsites() {
        if (this.currentProject === 'default') {
            await this.loadAllProjects();
        }
        else {
            await this.loadSingleProject(this.currentProject);
        }
    }
    async loadAllProjects() {
        const websitesPath = path.join(this.rootPath, 'websites');
        if (!fs.existsSync(websitesPath)) {
            console.log('No websites directory found');
            return;
        }
        const projects = await fs.promises.readdir(websitesPath);
        for (const project of projects) {
            const projectPath = path.join(websitesPath, project);
            if ((await fs.promises.stat(projectPath)).isDirectory()) {
                await this.loadSingleProject(project);
            }
        }
    }
    async loadSingleProject(project) {
        const configPath = path.join(this.rootPath, 'websites', project, 'config.js');
        let config = {};
        try {
            if (fs.existsSync(configPath)) {
                config = require(configPath).config;
            }
        }
        catch (err) {
            console.error(`Error loading config for ${project}:`, err);
        }
        const website = new website_1.Website(project, config, this.rootPath);
        await website.loadViews();
        this.websites.set(project, website);
    }
    setupHttpServer(port) {
        this.httpServer = http.createServer((req, res) => {
            this.emit('request', req, res);
        });
        this.httpServer.listen(port, () => {
            console.log(`Server started on port ${port}`);
        });
    }
    setupSocketServer() {
        if (!this.httpServer) {
            throw new Error('HTTP server must be initialized before socket server');
        }
        this.socketServer = new socket_io_1.Server(this.httpServer);
        this.setupSocketHandlers();
    }
    setupSocketHandlers() {
        if (!this.socketServer)
            return;
        this.socketServer.on('connection', (socket) => {
            this.emit('connection', socket);
        });
    }
    getWebsiteForHost(host) {
        for (const website of this.websites.values()) {
            if (website.config.domains?.includes(host)) {
                return website;
            }
        }
        return this.websites.get(this.currentProject) || null;
    }
}
exports.ThaliaServer = ThaliaServer;
