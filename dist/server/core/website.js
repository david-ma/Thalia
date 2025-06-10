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
exports.Website = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const Handlebars = __importStar(require("handlebars"));
class Website {
    constructor(name, config, rootPath) {
        this.name = name;
        this.config = this.validateConfig(config);
        this.rootPath = rootPath;
        this.views = new Map();
        this.handlebars = Handlebars.create();
    }
    validateConfig(config) {
        return {
            cache: typeof config.cache === 'boolean' ? config.cache : true,
            folder: typeof config.folder === 'string'
                ? config.folder
                : path.resolve(this.rootPath, 'websites', this.name, 'public'),
            workspacePath: typeof config.workspacePath === 'string'
                ? config.workspacePath
                : path.resolve(this.rootPath, 'websites', this.name),
            domains: Array.isArray(config.domains) ? config.domains : [],
            pages: typeof config.pages === 'object' ? config.pages : {},
            redirects: typeof config.redirects === 'object' ? config.redirects : {},
            services: typeof config.services === 'object' ? config.services : {},
            controllers: typeof config.controllers === 'object' ? config.controllers : {},
            proxies: typeof config.proxies === 'object' ? config.proxies : {},
            sockets: typeof config.sockets === 'object'
                ? config.sockets
                : { on: [], emit: [] },
            security: typeof config.security === 'object'
                ? config.security
                : {
                    loginNeeded: () => false
                },
            viewableFolders: config.viewableFolders || false,
            ...config
        };
    }
    async loadViews() {
        const viewsPath = path.join(this.rootPath, 'websites', this.name, 'views');
        if (!fs.existsSync(viewsPath)) {
            return;
        }
        const files = await fs.promises.readdir(viewsPath);
        for (const file of files) {
            if (file.endsWith('.hbs')) {
                const content = await fs.promises.readFile(path.join(viewsPath, file), 'utf-8');
                const name = path.basename(file, '.hbs');
                this.views.set(name, content);
                this.handlebars.registerPartial(name, content);
            }
        }
    }
    async renderTemplate(template, data) {
        const templateContent = this.views.get(template);
        if (!templateContent) {
            throw new Error(`Template ${template} not found`);
        }
        const compiledTemplate = this.handlebars.compile(templateContent);
        return compiledTemplate(data);
    }
    getProxyForHost(host) {
        if (!this.config.proxies) {
            return null;
        }
        if (Array.isArray(this.config.proxies)) {
            const proxy = this.config.proxies.find(p => p.domains?.includes(host));
            return proxy || null;
        }
        return this.config.proxies[host] || null;
    }
    getControllerForPath(path) {
        if (!this.config.controllers) {
            return null;
        }
        // Remove leading slash and get first path segment
        const pathSegment = path.replace(/^\//, '').split('/')[0];
        return this.config.controllers[pathSegment] || null;
    }
    getServiceForPath(path) {
        if (!this.config.services) {
            return null;
        }
        // Remove leading slash and get first path segment
        const pathSegment = path.replace(/^\//, '').split('/')[0];
        return this.config.services[pathSegment] || null;
    }
}
exports.Website = Website;
//# sourceMappingURL=website.js.map