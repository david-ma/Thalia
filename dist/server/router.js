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
        this.websites = websites;
    }
    getWebsite(path) {
        console.log(path);
        return this.websites[0] || null;
    }
}
exports.Router = Router;
//# sourceMappingURL=router.js.map