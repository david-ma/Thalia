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
class Website {
    /**
     * Creates a new Website instance
     * @param config - The website configuration
     */
    constructor(config) {
        this.name = config.name;
        this.config = config;
        this.rootPath = config.rootPath;
    }
    /**
     * Loads a website from its configuration
     * @param config - The website configuration
     * @returns Promise resolving to a new Website instance
     */
    static async load(config) {
        return new Website(config);
    }
    static async loadAll(options) {
        if (options.mode == 'multiplex') {
            // Check if the root path exists
            // Load all websites from the root path
            const websites = await fs_1.default.readdirSync('websites');
            return websites.map(website => new Website({
                name: website,
                rootPath: path_1.default.join(options.rootPath, website)
            }));
        }
        return [new Website({
                name: options.project,
                rootPath: "Rootpath"
            })];
    }
}
exports.Website = Website;
//# sourceMappingURL=website.js.map