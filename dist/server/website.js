/**
 * Website - Website configuration and management
 *
 * The Website class is responsible for:
 * 1. Managing website configuration
 * 2. Coordinating between Router and Handler
 * 3. Providing website-specific functionality
 * 4. Loading website resources
 * 5. Managing database connections
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
import { cwd } from 'process';
import { RoleRouteGaurd, BasicRouteGuard, RouteGuard } from './route-guard.js';
import { ThaliaDatabase } from './database.js';
export class Website {
    /**
     * Creates a new Website instance
     * Should only be called by the static "create" method
     */
    constructor(config) {
        this.env = 'development';
        this.mode = 'standalone';
        this.port = 1337;
        this.handlebars = Handlebars.create();
        this.domains = [];
        this.controllers = {};
        this.routes = {};
        console.log(`Loading website "${config.name}"`);
        this.name = config.name;
        this.rootPath = config.rootPath;
        this.mode = config.mode;
        this.port = config.port;
    }
    /**
     * Given a basic website config (name & rootPath), load the website.
     */
    static async create(config) {
        const website = new Website(config);
        return Promise.all([website.loadPartials(), website.loadConfig(config).then(() => website.loadDatabase())]).then(() => {
            if (website.config.security) {
                website.routeGuard = new RoleRouteGaurd(website);
            }
            else if (website.config.routes.length > 0) {
                website.routeGuard = new BasicRouteGuard(website);
            }
            else {
                website.routeGuard = new RouteGuard(website);
            }
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
            },
        };
        return new Promise((resolve, reject) => {
            const configPath = path.join(this.rootPath, 'config', 'config.js');
            import('file://' + configPath)
                .then((configFile) => {
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
            })
                .then(() => {
                this.domains = this.config.domains;
                // If in standalone mode, add localhost to the domains
                if (this.mode === 'standalone') {
                    this.domains.push('localhost');
                    this.domains.push(`localhost:${this.port}`);
                }
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
        const paths = [
            path.join(cwd(), 'node_modules', 'thalia', 'src', 'views'),
            path.join(cwd(), 'src', 'views'),
            path.join(cwd(), 'websites', 'example', 'src', 'partials'),
            path.join(this.rootPath, 'src', 'partials'),
        ];
        for (const path of paths) {
            if (fs.existsSync(path)) {
                this.readAllViewsInFolder(path);
            }
        }
    }
    // public ser
    getContentHtml(content, template = 'wrapper') {
        if (this.env == 'development') {
            this.loadPartials();
        }
        const templateFile = this.handlebars.partials[template] ?? '';
        const contentFile = this.handlebars.partials[content] ?? '404';
        this.handlebars.registerPartial('styles', '');
        this.handlebars.registerPartial('scripts', '');
        this.handlebars.registerPartial('content', '');
        this.handlebars.registerPartial('content', contentFile);
        return this.handlebars.compile(templateFile);
    }
    /**
     * "Templates" are higher level than the partials, so we don't register them as partials
     * Not sure if this is necessary. There probably isn't any danger in registering them as partials.
     * But this could be safer.
     */
    templates() {
        const templates = {};
        const paths = [
            path.join(cwd(), 'node_modules', 'thalia', 'src', 'views'),
            path.join(cwd(), 'src', 'views'),
            path.join(cwd(), 'websites', 'example', 'src'),
            path.join(this.rootPath, 'src'),
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
        this.handlebars.registerPartial('styles', '');
        this.handlebars.registerPartial('scripts', '');
        this.handlebars.registerPartial('content', '');
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
            console.error('Error rendering error: ', newError);
            console.error('Original Error: ', error);
            res.end(`500 Error`);
        }
    }
    async asyncServeHandlebarsTemplate(options) {
        return new Promise((resolve, reject) => {
            try {
                this.serveHandlebarsTemplate(options);
                resolve();
            }
            catch (error) {
                reject(error);
            }
        });
    }
    serveHandlebarsTemplate({ res, template, templatePath, data, }) {
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
            data = data ?? {};
            const compiledTemplate = this.handlebars.compile(templateFile);
            const html = compiledTemplate(data);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
            return;
        }
        catch (error) {
            console.error('Error serving handlebars template: ', error);
            this.renderError(res, error);
        }
    }
    static async loadAllWebsites(options) {
        if (options.mode == 'multiplex') {
            // Check if the root path exists
            // Load all websites from the root path (should be the websites folder)
            const websites = fs.readdirSync(options.rootPath);
            return Promise.all(websites.map(async (website) => {
                return Website.create({
                    name: website,
                    rootPath: path.join(options.rootPath, website),
                    mode: options.mode,
                    port: options.port,
                });
            }));
        }
        return Promise.all([
            Website.create({
                name: options.project,
                rootPath: options.rootPath,
                mode: options.mode,
                port: options.port,
            }),
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
    /**
     * Load database configuration and initialize database connection
     */
    loadDatabase() {
        return new Promise((resolve) => {
            if (this.config.database) {
                const db = new ThaliaDatabase(this);
                this.db = db;
                resolve(this.db.init());
            }
            else {
                resolve(null);
            }
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
export function recursiveObjectMerge(primary, secondary) {
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