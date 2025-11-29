import { Server } from './server.js';
import { Website } from './website.js';
// import { Database } from './database.js'
// import { RouteGuard } from './route-guard.js'
// Main Thalia class for easy initialization
export class Thalia {
    constructor(options, websites) {
        this.websites = websites;
        this.server = new Server(options, this.websites);
    }
    // This should probably be called init
    static async init(options) {
        try {
            const websites = await Website.loadAllWebsites(options);
            // Filter out any websites that failed to load
            const validWebsites = websites.filter((website) => website !== null && website !== undefined);
            if (validWebsites.length === 0) {
                console.error('Error loading websites: No valid websites found');
                process.exit(1);
            }
            return new Thalia(options, validWebsites);
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