"use strict";
/**
 * Router - Request routing implementation
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Router = void 0;
class Router {
    constructor(websites) {
        // assert that websites is not empty
        if (websites.length === 0) {
            throw new Error('No websites provided');
        }
        this.default = websites[0];
        // Create a map of websites
        this.websites = websites.reduce((acc, website) => {
            if (website.name == 'default') {
                this.default = website;
            }
            acc[website.name] = website;
            return acc;
        }, {});
    }
    getWebsite(domain) {
        // // Get the website name from the path
        // const websiteName = path.split('/')[1]
        // if (!websiteName) {
        //   throw new Error('No website name provided')
        // }
        // // Get the website from the map
        // const website = this.websites[websiteName]
        // if (!website) {
        //   throw new Error(`Website ${websiteName} not found`)
        // }
        // return website
        return this.websites[domain] || this.default;
    }
}
exports.Router = Router;
//# sourceMappingURL=router.js.map