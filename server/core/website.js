"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Website = void 0;
const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
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
        const pathSegment = path.replace(/^\//, '').split('/')[0];
        return this.config.controllers[pathSegment] || null;
    }
    getServiceForPath(path) {
        if (!this.config.services) {
            return null;
        }
        const pathSegment = path.replace(/^\//, '').split('/')[0];
        return this.config.services[pathSegment] || null;
    }
}
exports.Website = Website;
