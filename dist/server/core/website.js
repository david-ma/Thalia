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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Website = void 0;
const router_1 = require("./router");
const handler_1 = require("./handler");
class Website {
    /**
     * Creates a new Website instance
     * @param config - The website configuration
     */
    constructor(config) {
        this.name = config.name;
        this.config = config;
        this.rootPath = config.rootPath;
        this.router = new router_1.Router();
        this.handler = new handler_1.Handler(this);
        // Set up routes from config
        if (config.routes) {
            config.routes.forEach(route => this.router.addRoute(route));
        }
    }
    /**
     * Loads a website from its configuration
     * @param config - The website configuration
     * @returns Promise resolving to a new Website instance
     */
    static async load(config) {
        return new Website(config);
    }
}
exports.Website = Website;
//# sourceMappingURL=website.js.map