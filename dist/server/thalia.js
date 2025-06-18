import { Server } from './server.js';
import { Website } from './website.js';
export class Thalia {
    constructor(options, websites) {
        this.websites = websites;
        this.server = new Server(options, this.websites);
    }
    static async create(options) {
        try {
            const websites = await Website.loadAllWebsites(options);
            return new Thalia(options, websites);
        }
        catch (error) {
            console.error('Error loading websites:', error);
            process.exit(1);
        }
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