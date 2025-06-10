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
class Website {
    /**
     * Creates a new Website instance
     * @param config - The website configuration
     */
    constructor(config) {
        this.templates = new Map();
        this.name = config.name;
        this.config = config;
        this.rootPath = config.rootPath;
        // Read all the partials from the partials folder
        const partialsPath = path_1.default.join(this.rootPath, 'src', 'partials');
        if (fs_1.default.existsSync(partialsPath)) {
            const partials = fs_1.default.readdirSync(partialsPath);
            partials.forEach(partial => {
                Website.handlebars.registerPartial(partial.replace('.hbs', ''), fs_1.default.readFileSync(path_1.default.join(partialsPath, partial), 'utf8'));
            });
        }
    }
    handleRequest(req, res) {
        console.log("We have a request for: ", req.url);
        // Get the requested file path
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
        const filePath = path_1.default.join(this.rootPath, 'public', pathname);
        console.log("Looking for file: ", filePath);
        const handlebarsTemplate = filePath.replace('.html', '.hbs').replace('public', 'src');
        console.log("Looking for handlebars template: ", handlebarsTemplate);
        // Check if the file is a handlebars template
        if (filePath.endsWith('.html') && fs_1.default.existsSync(handlebarsTemplate)) {
            const template = fs_1.default.readFileSync(handlebarsTemplate, 'utf8');
            const compiledTemplate = Website.handlebars.compile(template);
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
    /**
     * Loads a website from its configuration
     * @param config - The website configuration
     * @returns Promise resolving to a new Website instance
     */
    static async load(config) {
        return new Website(config);
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
Website.handlebars = handlebars_1.default.create();
//# sourceMappingURL=website.js.map