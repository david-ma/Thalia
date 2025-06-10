"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.latestlogs = exports.controllerFactories = exports.Website = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const handlebars_1 = __importDefault(require("handlebars"));
const sass_1 = __importDefault(require("sass"));
const process_1 = require("process");
const route_guard_1 = require("./route-guard");
class Website {
    /**
     * Creates a new Website instance
     * @param config - The website configuration
     */
    constructor(config) {
        this.handlebars = handlebars_1.default.create();
        this.domains = [];
        this.controllers = {};
        this.routes = {};
        this.name = config.name;
        this.config = config;
        this.rootPath = config.rootPath;
        this.loadPartials();
        this.loadConfig();
        this.routeGuard = new route_guard_1.RouteGuard(this);
    }
    loadConfig() {
        // check if we have a config.js in the project folder, and import it if it exists
        if (fs_1.default.existsSync(path_1.default.join(this.rootPath, 'config', 'config.js'))) {
            const config = require(path_1.default.join(this.rootPath, 'config', 'config.js')).config;
            this.config = {
                ...this.config,
                ...config,
            };
        }
        this.domains = this.config.domains || [];
        if (this.domains.length === 0) {
            this.domains.push('localhost');
        }
        // Add the project name to the domains
        this.domains.push(`${this.name}.com`);
        this.domains.push(`www.${this.name}.com`);
        this.domains.push(`${this.name}.david-ma.net`);
        // Load and validate controllers
        const rawControllers = this.config.controllers || {};
        for (const [name, controller] of Object.entries(rawControllers)) {
            this.controllers[name] = this.validateController(controller);
        }
        // console.debug("Loaded controllers: ", Object.keys(this.controllers))
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
    readAllViewsInFolder(folder) {
        const views = {};
        try {
            const entries = fs_1.default.readdirSync(folder, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path_1.default.join(folder, entry.name);
                if (entry.isDirectory()) {
                    // Recursively read subdirectories
                    const subViews = this.readAllViewsInFolder(fullPath);
                    Object.assign(views, subViews);
                }
                else if (entry.name.match(/\.(hbs|mustache)$/)) {
                    // Read template files
                    const content = fs_1.default.readFileSync(fullPath, 'utf8');
                    const name = entry.name.replace(/\.(hbs|mustache)$/, '');
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
    handleRequest(req, res, pathname) {
        // Let the route guard handle the request first
        if (this.routeGuard.handleRequest(req, res, this)) {
            return; // Request was handled by the guard
        }
        // Continue with normal request handling
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        pathname = pathname || url.pathname;
        const filePath = path_1.default.join(this.rootPath, 'public', pathname);
        const sourcePath = filePath.replace('public', 'src');
        const controllerPath = pathname.split('/')[1];
        if (controllerPath) {
            const controller = this.controllers[controllerPath];
            if (controller) {
                controller(res, req, this);
                return;
            }
        }
        // If we're looking for a css file, check if the scss exists
        if (filePath.endsWith('.css') && fs_1.default.existsSync(sourcePath.replace('.css', '.scss'))) {
            const scss = fs_1.default.readFileSync(sourcePath.replace('.css', '.scss'), 'utf8');
            const css = sass_1.default.renderSync({ data: scss }).css.toString();
            res.writeHead(200, { 'Content-Type': 'text/css' });
            res.end(css);
            return;
        }
        const handlebarsTemplate = filePath.replace('.html', '.hbs').replace('public', 'src');
        // Check if the file is a handlebars template
        if (filePath.endsWith('.html') && fs_1.default.existsSync(handlebarsTemplate)) {
            const template = fs_1.default.readFileSync(handlebarsTemplate, 'utf8');
            const compiledTemplate = this.handlebars.compile(template);
            const html = compiledTemplate({});
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
            return;
        }
        // Check if file exists
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
        // Stream the file
        const stream = fs_1.default.createReadStream(filePath);
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
    static loadAllWebsites(options) {
        if (options.mode == 'multiplex') {
            // Check if the root path exists
            // Load all websites from the root path
            const websites = fs_1.default.readdirSync(options.rootPath);
            return websites.map(website => new Website({
                name: website,
                rootPath: path_1.default.join(options.rootPath, website)
            }));
        }
        return [new Website({
                name: options.project,
                rootPath: options.rootPath
            })];
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
/**
 * Read the latest 10 logs from the log directory
 */
const latestlogs = async (res, _req, website) => {
    try {
        const logDirectory = path_1.default.join(website.rootPath, 'public', 'log');
        // Get list of log files
        const logs = fs_1.default.readdirSync(logDirectory)
            .filter(filename => !filename.startsWith('.'))
            .slice(-10);
        if (logs.length === 0) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('No logs found');
            return;
        }
        // Get stats for all logs
        const stats = await Promise.all(logs.map(log => fs_1.default.promises.stat(path_1.default.join(logDirectory, log))));
        // Prepare data for template
        const data = {
            stats: logs.map((log, i) => ({
                filename: log,
                size: stats[i]?.size ?? 0,
                created: stats[i]?.birthtime?.toLocaleString() ?? 'Unknown',
                lastModified: stats[i]?.mtime?.toLocaleString() ?? 'Unknown'
            }))
        };
        // Get and compile template
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
//# sourceMappingURL=website.js.map