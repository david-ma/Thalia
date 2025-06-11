/**
 * index.ts - Main entry point for Thalia
 *
 * This file serves as the main entry point for the Thalia framework.
 *
 * Find the default project
 * Find out if we're running in standalone mode or multiplex mode
 * Find the port
 *
 */
import { cwd } from 'process';
import { Server } from './server';
import { Website } from './website';
import path from 'path';
import { Database } from './database';
import { RouteGuard } from './route-guard';
// Re-export types
export * from './types';
// Export main components
export { Server, Website, Database, RouteGuard };
// Export security
export * from './security';
// Export models
export * from '../models';
// Main Thalia class for easy initialization
export class Thalia {
    constructor(options) {
        this.websites = Website.loadAllWebsites(options);
        this.server = new Server(options, this.websites);
    }
    async start() {
        await this.server.start();
    }
    async stop() {
        await this.server.stop();
    }
    getServer() {
        return this.server;
    }
}
const project = process.argv.find(arg => arg.startsWith('--project'))?.split('=')[1] || process.env['PROJECT'] || 'default';
const port = parseInt(process.argv.find(arg => arg.startsWith('--port'))?.split('=')[1] || process.env['PORT'] || '3000');
let options = {
    mode: 'standalone',
    project: project,
    rootPath: cwd(),
    port: port
};
if (project == 'default') {
    console.log(`Running in multiplex mode. Loading all projects.`);
    options.mode = 'multiplex';
    options.rootPath = path.join(options.rootPath, 'websites');
}
else {
    console.log(`Running in standalone mode for project: ${project}`);
    options.mode = 'standalone';
    options.rootPath = path.join(options.rootPath, 'websites', project);
}
const thalia = new Thalia(options);
thalia.start();
//# sourceMappingURL=index.js.map