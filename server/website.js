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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.latestlogs = exports.controllerFactories = exports.Website = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const handlebars_1 = __importDefault(require("handlebars"));
const sass = __importStar(require("sass"));
const process_1 = require("process");
const route_guard_js_1 = require("./route-guard.js");
class Website {
    constructor(config) {
        this.env = 'development';
        this.handlebars = handlebars_1.default.create();
        this.domains = [];
        this.controllers = {};
        this.routes = {};
        console.log(`Loading website "${config.name}"`);
        this.name = config.name;
        this.rootPath = config.rootPath;
    }
    static async create(config) {
        const website = new Website(config);
        return Promise.all([
            website.loadPartials(),
            website.loadConfig(config)
        ]).then(() => {
            website.routeGuard = new route_guard_js_1.RouteGuard(website);
            return website;
        });
    }
    async loadConfig(basicConfig) {
        this.config = {
            ...basicConfig,
            domains: [],
            controllers: {},
            routes: [],
            websockets: {
                listeners: {},
                onSocketConnection: (socket, clientInfo) => {
                    console.log('Client connected:', {
                        socketId: socket.id,
                        ...clientInfo,
                        timestamp: new Date().toISOString()
                    });
                },
                onSocketDisconnect: (socket, clientInfo) => {
                    console.log('Client disconnected:', {
                        socketId: socket.id,
                        ...clientInfo,
                        timestamp: new Date().toISOString()
                    });
                },
            }
        };
        return new Promise((resolve, reject) => {
            var _a;
            const configPath = path_1.default.join(this.rootPath, 'config', 'config.js');
            (_a = 'file://' + configPath, Promise.resolve().then(() => __importStar(require(_a)))).then((configFile) => {
                if (!configFile.config) {
                    throw new Error(`configFile for ${this.name} has no exported config.`);
                }
                this.config = recursiveObjectMerge(this.config, configFile.config);
            }, (err) => {
                if (fs_1.default.existsSync(configPath)) {
                    console.error('config.js failed to load for', this.name);
                    console.error(err);
                }
                else {
                    console.error(`Website "${this.name}" does not have a config.js file`);
                }
            }).then(() => {
                this.domains = this.config.domains || [];
                if (this.domains.length === 0) {
                    this.domains.push('localhost');
                }
                this.domains.push(`${this.name}.com`);
                this.domains.push(`www.${this.name}.com`);
                this.domains.push(`${this.name}.david-ma.net`);
                this.domains.push(`${this.name}.net`);
                this.domains.push(`${this.name}.org`);
                this.domains.push(`${this.name}.com.au`);
                const rawControllers = this.config.controllers || {};
                for (const [name, controller] of Object.entries(rawControllers)) {
                    this.controllers[name] = this.validateController(controller);
                }
                resolve(this);
            }, reject);
        });
    }
    validateController(controller) {
        const controllerStr = controller.toString();
        const params = controllerStr.slice(controllerStr.indexOf('(') + 1, controllerStr.indexOf(')')).split(',');
        if (params.length !== 3) {
            console.log(Object.entries(controller));
            console.error(`Controller: ${controllerStr} must accept exactly 3 parameters (res, req, website)`);
            throw new Error(`Controller must accept exactly 3 parameters (res, req, website)`);
        }
        return controller;
    }
    loadPartials() {
        const paths = [
            path_1.default.join((0, process_1.cwd)(), 'src', 'views'),
            path_1.default.join((0, process_1.cwd)(), 'websites', 'example', 'src', 'partials'),
            path_1.default.join(this.rootPath, 'src', 'partials')
        ];
        for (const path of paths) {
            if (fs_1.default.existsSync(path)) {
                this.readAllViewsInFolder(path);
            }
        }
    }
    templates() {
        const templates = {};
        const paths = [
            path_1.default.join((0, process_1.cwd)(), 'src', 'views'),
            path_1.default.join((0, process_1.cwd)(), 'websites', 'example', 'src'),
            path_1.default.join(this.rootPath, 'src')
        ];
        for (const filepath of paths) {
            if (fs_1.default.existsSync(filepath)) {
                const files = fs_1.default.readdirSync(filepath);
                for (const file of files) {
                    if (file.endsWith('.hbs') || file.endsWith('.handlebars') || file.endsWith('.mustache')) {
                        const templateName = file.replace(/\.(hbs|handlebars|mustache)$/, '');
                        templates[templateName] = fs_1.default.readFileSync(path_1.default.join(filepath, file), 'utf8');
                    }
                }
            }
        }
        return templates;
    }
    readAllViewsInFolder(folder) {
        const views = {};
        try {
            const entries = fs_1.default.readdirSync(folder, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path_1.default.join(folder, entry.name);
                if (entry.isDirectory()) {
                    const subViews = this.readAllViewsInFolder(fullPath);
                    Object.assign(views, subViews);
                }
                else if (entry.name.match(/\.(hbs|handlebars|mustache)$/)) {
                    const content = fs_1.default.readFileSync(fullPath, 'utf8');
                    const name = entry.name.replace(/\.(hbs|handlebars|mustache)$/, '');
                    views[name] = content;
                }
            }
        }
        catch (error) {
            console.error(`Error reading views from ${folder}:`, error);
        }
        Object.entries(views).forEach(([name, content]) => {
            this.handlebars.registerPartial(name, content);
        });
        return views;
    }
    renderError(res, error) {
        res.writeHead(500);
        try {
            const template = this.handlebars.partials['error'];
            const compiledTemplate = this.handlebars.compile(template);
            let data = {};
            if (this.env == 'development') {
                data = {
                    website: this.name,
                    error: error.message,
                    stack: error.stack,
                };
            }
            const html = compiledTemplate(data);
            res.end(html);
        }
        catch (newError) {
            console.error("Error rendering error: ", newError);
            console.error("Original Error: ", error);
            res.end(`500 Error`);
        }
    }
    serveHandlebarsTemplate({ res, template, templatePath, data }) {
        try {
            if (this.env == 'development') {
                this.loadPartials();
            }
            let templateFile = '';
            if (templatePath) {
                templateFile = fs_1.default.readFileSync(templatePath, 'utf8');
            }
            else if (template) {
                templateFile = this.templates()[template] ?? this.handlebars.partials[template];
            }
            if (!templateFile) {
                throw new Error(`Template ${template} not found`);
            }
            if (this.env == 'development') {
                templateFile = templateFile.replace('</body>', '{{> browsersync }}\n</body>');
            }
            const compiledTemplate = this.handlebars.compile(templateFile);
            const html = compiledTemplate(data);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
            return;
        }
        catch (error) {
            this.renderError(res, error);
        }
    }
    handleRequest(req, res, pathname) {
        try {
            if (this.routeGuard.handleRequest(req, res, this, pathname)) {
                return;
            }
            const url = new URL(req.url || '/', `http://${req.headers.host}`);
            pathname = pathname || url.pathname;
            const parts = pathname.split('/');
            if (parts.some(part => part === '..')) {
                res.writeHead(400);
                res.end('Bad Request');
                return;
            }
            const filePath = path_1.default.join(this.rootPath, 'public', pathname);
            const sourcePath = filePath.replace('public', 'src');
            const controllerPath = parts[1];
            if (controllerPath !== null) {
                const controller = this.controllers[controllerPath];
                if (controller) {
                    controller(res, req, this);
                    return;
                }
            }
            if (filePath.endsWith('.css') && fs_1.default.existsSync(sourcePath.replace('.css', '.scss'))) {
                const scss = fs_1.default.readFileSync(sourcePath.replace('.css', '.scss'), 'utf8');
                try {
                    const css = sass.renderSync({ data: scss }).css.toString();
                    res.writeHead(200, { 'Content-Type': 'text/css' });
                    res.end(css);
                }
                catch (error) {
                    console.error("Error compiling scss: ", error);
                    res.writeHead(500);
                    res.end('Internal Server Error');
                    return;
                }
                return;
            }
            const handlebarsTemplate = filePath.replace('.html', '.hbs').replace('public', 'src');
            if (filePath.endsWith('.html') && fs_1.default.existsSync(handlebarsTemplate)) {
                this.serveHandlebarsTemplate({ res, templatePath: handlebarsTemplate });
                return;
            }
            if (!fs_1.default.existsSync(filePath)) {
                res.writeHead(404);
                res.end('Not Found');
                return;
            }
            else if (fs_1.default.statSync(filePath).isDirectory()) {
                try {
                    const indexPath = path_1.default.join(url.pathname, 'index.html');
                    this.handleRequest(req, res, indexPath);
                }
                catch (error) {
                    console.error("Error serving index.html for ", url.pathname, error);
                    res.writeHead(404);
                    res.end('Not Found');
                }
                return;
            }
            const stream = fs_1.default.createReadStream(filePath);
            stream.on('error', (error) => {
                console.error('Error streaming file:', error);
                res.writeHead(500);
                res.end('Internal Server Error');
            });
            const contentType = this.getContentType(filePath);
            res.setHeader('Content-Type', contentType);
            stream.pipe(res);
        }
        catch (error) {
            console.error("Error serving file: ", error);
            res.writeHead(500);
            res.end('Internal Server Error');
        }
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
    static async loadAllWebsites(options) {
        if (options.mode == 'multiplex') {
            const websites = fs_1.default.readdirSync(options.rootPath);
            return Promise.all(websites.map(async (website) => {
                return Website.create({
                    name: website,
                    rootPath: path_1.default.join(options.rootPath, website)
                });
            }));
        }
        return Promise.all([
            Website.create({
                name: options.project,
                rootPath: options.rootPath
            })
        ]);
    }
    handleSocketConnection(socket) {
        socket.on('hello', (data) => {
            console.log('Hello received:', data);
            socket.emit('handshake', 'We received your hello');
        });
    }
}
exports.Website = Website;
exports.controllerFactories = {
    redirectTo: (url) => {
        return (res, _req, _website) => {
            res.writeHead(302, { Location: url });
            res.end();
        };
    },
    serveFile: (url) => {
        return (res, _req, website) => {
            const filePath = path_1.default.join(website.rootPath, 'public', url);
            const stream = fs_1.default.createReadStream(filePath);
            stream.pipe(res);
        };
    },
};
const latestlogs = async (res, _req, website) => {
    try {
        const logDirectory = path_1.default.join(website.rootPath, 'public', 'log');
        if (!fs_1.default.existsSync(logDirectory)) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('No logs found');
            return;
        }
        const logs = fs_1.default.readdirSync(logDirectory)
            .filter(filename => !filename.startsWith('.'))
            .slice(-10);
        if (logs.length === 0) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('No logs found');
            return;
        }
        const stats = await Promise.all(logs.map(log => fs_1.default.promises.stat(path_1.default.join(logDirectory, log))));
        const data = {
            stats: logs.map((log, i) => ({
                filename: log,
                size: stats[i]?.size ?? 0,
                created: stats[i]?.birthtime?.toLocaleString() ?? 'Unknown',
                lastModified: stats[i]?.mtime?.toLocaleString() ?? 'Unknown'
            }))
        };
        const template = website.handlebars.partials['logs'];
        if (!template) {
            throw new Error('logs template not found');
        }
        const html = website.handlebars.compile(template)(data);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }
    catch (error) {
        console.error(`Error in ${website.name}/latestlogs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
exports.latestlogs = latestlogs;
function recursiveObjectMerge(primary, secondary) {
    const result = { ...primary };
    const primaryKeys = Object.keys(primary);
    for (const key in secondary) {
        if (!primaryKeys.includes(key)) {
            result[key] = secondary[key];
        }
        else if (Array.isArray(secondary[key])) {
            if (Array.isArray(result[key])) {
                result[key] = result[key].concat(secondary[key]);
            }
            else {
                result[key] = secondary[key];
            }
        }
        else if (typeof secondary[key] === 'object') {
            if (typeof result[key] === 'object') {
                result[key] = recursiveObjectMerge(result[key], secondary[key]);
            }
            else {
                result[key] = secondary[key];
            }
        }
        else {
            result[key] = secondary[key];
        }
    }
    return result;
}
