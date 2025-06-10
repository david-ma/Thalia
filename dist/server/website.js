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
exports.Website = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const handlebars_1 = __importDefault(require("handlebars"));
const sass_1 = __importDefault(require("sass"));
const process_1 = require("process");
class Website {
    /**
     * Creates a new Website instance
     * @param config - The website configuration
     */
    constructor(config) {
        this.handlebars = handlebars_1.default.create();
        this.domains = [];
        this.controllers = {};
        this.name = config.name;
        this.config = config;
        this.rootPath = config.rootPath;
        this.loadPartials();
        this.loadConfig();
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
        // Load controllers
        const controllers = this.config.controllers || [];
        console.log("Loaded controllers: ", controllers);
        // Test the controllers?
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
    handleRequest(req, res) {
        // console.debug("We have a request for: ", req.url)
        // Get the requested file path
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
        const filePath = path_1.default.join(this.rootPath, 'public', pathname);
        const sourcePath = filePath.replace('public', 'src');
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
        const website = new Website({
            name: options.project,
            rootPath: options.rootPath
        });
        return [website];
    }
}
exports.Website = Website;
//# sourceMappingURL=website.js.map