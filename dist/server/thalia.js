import { Server } from './server.js';
import { Website } from './website.js';
// import { Database } from './database.js'
// import { RouteGuard } from './route-guard.js'
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
//# sourceMappingURL=thalia.js.map