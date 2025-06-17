/**
 * Website - Website configuration and management
 *
 * The Website class is responsible for:
 * 1. Managing website configuration
 * 2. Coordinating between Router and Handler
 * 3. Providing website-specific functionality
 * 4. Loading website resources
 *
 * The Website:
 * - Holds website configuration
 * - Manages website-specific routes
 * - Coordinates request handling
 * - Provides website context
 *
 * It does NOT handle:
 * - HTTP server setup (handled by Server)
 * - Request routing (handled by Router)
 * - Request processing (handled by Handler)
 */
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import * as sass from 'sass';
import { cwd } from 'process';
import { RouteGuard } from './route-guard.js';
export class Website {
    /**
     * Creates a new Website instance
     * Should only be called by the static "create" method
     */
    constructor(config) {
        this.env = 'development';
        this.handlebars = Handlebars.create();
        this.domains = [];
        this.controllers = {};
        this.routes = {};
        console.log(`Loading website "${config.name}"`);
        this.name = config.name;
        this.rootPath = config.rootPath;
    }
    /**
     * Given a basic website config (name & rootPath), load the website.
     */
    static async create(config) {
        const website = new Website(config);
        return Promise.all([
            website.loadPartials(),
            website.loadConfig(config)
        ]).then(() => {
            website.routeGuard = new RouteGuard(website);
            return website;
        });
    }
    /**
     * Load config/config.js for the website, if it exists
     * If it doesn't exist, we'll use the default config
     */
    async loadConfig(basicConfig) {
        this.config = {
            ...basicConfig,
            domains: [],
            controllers: {},
            routes: [],
            websockets: {
                listeners: {},
                onSocketConnection: (socket, clientInfo) => {
                    console.log(`${clientInfo.timestamp} ${clientInfo.ip} SOCKET ${clientInfo.socketId} CONNECTED`);
                },
                onSocketDisconnect: (socket, clientInfo) => {
                    console.log(`${clientInfo.timestamp} ${clientInfo.ip} SOCKET ${clientInfo.socketId} DISCONNECTED`);
                },
            }
        };
        return new Promise((resolve, reject) => {
            const configPath = path.join(this.rootPath, 'config', 'config.js');
            import('file://' + configPath).then((configFile) => {
                if (!configFile.config) {
                    throw new Error(`configFile for ${this.name} has no exported config.`);
                }
                this.config = recursiveObjectMerge(this.config, configFile.config);
            }, (err) => {
                if (fs.existsSync(configPath)) {
                    console.error('config.js failed to load for', this.name);
                    console.error(err);
                }
                else {
                    console.error(`Website "${this.name}" does not have a config.js file`);
                }
            }).then(() => {
                this.domains = this.config.domains;
                // Add the project name to the domains
                this.domains.push(`${this.name}.com`);
                this.domains.push(`www.${this.name}.com`);
                this.domains.push(`${this.name}.david-ma.net`);
                this.domains.push(`${this.name}.net`);
                this.domains.push(`${this.name}.org`);
                this.domains.push(`${this.name}.com.au`);
                // Load and validate controllers
                const rawControllers = this.config.controllers || {};
                for (const [name, controller] of Object.entries(rawControllers)) {
                    this.controllers[name] = this.validateController(controller);
                }
                this.websockets = this.config.websockets;
                resolve(this);
            }, reject);
        });
    }
    validateController(controller) {
        // Check that controller is a function
        if (typeof controller !== 'function') {
            console.error(`Controller: ${controller} is not a function`);
            throw new Error(`Controller must be a function`);
        }
        // Check that controller accepts up to 4 parameters (res, req, website, requestInfo)
        return controller;
    }
    /**
     * Load partials from the following paths:
     * - thalia/src/views
     * - thalia/websites/example/src/partials
     * - thalia/websites/$PROJECT/src/partials
     *
     * The order is important, because later paths will override earlier paths.
     */
    loadPartials() {
        console.log('Loading partials for', this.name);
        const paths = [
            // node_modules/thalia/src/views
            path.join(cwd(), 'node_modules', 'thalia', 'src', 'views'),
            path.join(cwd(), 'src', 'views'),
            path.join(cwd(), 'websites', 'example', 'src', 'partials'),
            path.join(this.rootPath, 'src', 'partials')
        ];
        for (const path of paths) {
            if (fs.existsSync(path)) {
                this.readAllViewsInFolder(path);
            }
        }
        console.log('Partials loaded for', this.name);
        console.log(Object.keys(this.handlebars.partials));
    }
    /**
     * "Templates" are higher level than the partials, so we don't register them as partials
     * Not sure if this is necessary. There probably isn't any danger in registering them as partials.
     * But this could be safer.
     */
    templates() {
        const templates = {};
        const paths = [
            path.join(cwd(), 'src', 'views'),
            path.join(cwd(), 'websites', 'example', 'src'),
            path.join(this.rootPath, 'src')
        ];
        for (const filepath of paths) {
            if (fs.existsSync(filepath)) {
                // Read directory, get all .hbs, .handlebars, .mustache files
                const files = fs.readdirSync(filepath);
                for (const file of files) {
                    if (file.endsWith('.hbs') || file.endsWith('.handlebars') || file.endsWith('.mustache')) {
                        const templateName = file.replace(/\.(hbs|handlebars|mustache)$/, '');
                        templates[templateName] = fs.readFileSync(path.join(filepath, file), 'utf8');
                    }
                }
            }
        }
        return templates;
    }
    readAllViewsInFolder(folder) {
        const views = {};
        try {
            const entries = fs.readdirSync(folder, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(folder, entry.name);
                if (entry.isDirectory()) {
                    // Recursively read subdirectories
                    const subViews = this.readAllViewsInFolder(fullPath);
                    Object.assign(views, subViews);
                }
                else if (entry.name.match(/\.(hbs|handlebars|mustache)$/)) {
                    // Read template files
                    const content = fs.readFileSync(fullPath, 'utf8');
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
    async asyncServeHandlebarsTemplate({ res, template, templatePath, data }) {
        return new Promise((resolve, reject) => {
            try {
                this.serveHandlebarsTemplate({
                    res,
                    template,
                    templatePath,
                    data
                });
                resolve();
            }
            catch (error) {
                reject(error);
            }
        });
    }
    serveHandlebarsTemplate({ res, template, templatePath, data }) {
        try {
            if (this.env == 'development') {
                this.loadPartials();
            }
            let templateFile = '';
            if (templatePath) {
                templateFile = fs.readFileSync(templatePath, 'utf8');
            }
            else if (template) {
                templateFile = this.templates()[template] ?? this.handlebars.partials[template];
            }
            if (!templateFile) {
                throw new Error(`Template ${template} not found`);
            }
            if (this.env == 'development') {
                // insert a {{> browsersync }} before </body>
                templateFile = templateFile.replace('</body>', '{{> browsersync }}\n</body>');
            }
            const compiledTemplate = this.handlebars.compile(templateFile);
            const html = compiledTemplate(data);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
            return;
        }
        catch (error) {
            // console.error("Error serving handlebars template: ", error)
            this.renderError(res, error);
        }
    }
    // The main Request handler for the website
    // RequestHandler logic goes here
    handleRequest(req, res, requestInfo, pathname) {
        try {
            // Let the route guard handle the request first
            if (this.routeGuard.handleRequest(req, res, this, requestInfo, pathname)) {
                return; // Request was handled by the guard
            }
            // Continue with normal request handling
            const url = new URL(req.url || '/', `http://${req.headers.host}`);
            pathname = pathname || url.pathname;
            const parts = pathname.split('/');
            if (parts.some(part => part === '..')) {
                res.writeHead(400);
                res.end('Bad Request');
                return;
            }
            const filePath = path.join(this.rootPath, 'public', pathname);
            const sourcePath = filePath.replace('public', 'src');
            const controllerPath = parts[1];
            // console.debug(`Controller path: "${controllerPath}"`)
            if (controllerPath !== null) {
                const controller = this.controllers[controllerPath];
                if (controller) {
                    controller(res, req, this, requestInfo);
                    return;
                }
            }
            // If we're looking for a css file, check if the scss exists
            if (filePath.endsWith('.css') && fs.existsSync(sourcePath.replace('.css', '.scss'))) {
                const scss = fs.readFileSync(sourcePath.replace('.css', '.scss'), 'utf8');
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
            // Check if the file is a handlebars template
            if (filePath.endsWith('.html') && fs.existsSync(handlebarsTemplate)) {
                this.serveHandlebarsTemplate({ res, templatePath: handlebarsTemplate });
                return;
            }
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                res.writeHead(404);
                res.end('Not Found');
                return;
            }
            else if (fs.statSync(filePath).isDirectory()) {
                try {
                    const indexPath = path.join(url.pathname, 'index.html');
                    this.handleRequest(req, res, requestInfo, indexPath);
                }
                catch (error) {
                    console.error("Error serving index.html for ", url.pathname, error);
                    res.writeHead(404);
                    res.end('Not Found');
                }
                return;
            }
            // Stream the file
            const stream = fs.createReadStream(filePath);
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
            // Check if the root path exists
            // Load all websites from the root path (should be the websites folder)
            const websites = fs.readdirSync(options.rootPath);
            return Promise.all(websites.map(async (website) => {
                return Website.create({
                    name: website,
                    rootPath: path.join(options.rootPath, website)
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
    /**
     * Handle a socket connection for the website
     * Run the default listeners, and then run the website's listeners
     */
    handleSocketConnection(socket, clientInfo) {
        this.websockets.onSocketConnection(socket, clientInfo);
        const listeners = this.config.websockets?.listeners || {};
        for (const [eventName, listener] of Object.entries(listeners)) {
            socket.on(eventName, (data) => {
                listener(socket, data, clientInfo);
            });
        }
        socket.on('disconnect', (reason, description) => {
            this.websockets.onSocketDisconnect(socket, clientInfo);
        });
    }
}
export const controllerFactories = {
    redirectTo: (url) => {
        return (res, _req, _website) => {
            res.writeHead(302, { Location: url });
            res.end();
        };
    },
    serveFile: (url) => {
        return (res, _req, website) => {
            const filePath = path.join(website.rootPath, 'public', url);
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
        };
    },
};
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
//# sourceMappingURL=website.js.map