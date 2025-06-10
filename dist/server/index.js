"use strict";
/**
 * Thalia - Main entry point
 *
 * This file serves as the main entry point for the Thalia framework.
 * It exports all components and provides the main Thalia class for
 * server initialization.
 */
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Thalia = exports.Server = void 0;
const server_1 = require("./server");
Object.defineProperty(exports, "Server", { enumerable: true, get: function () { return server_1.Server; } });
// Re-export types
__exportStar(require("./core/types"), exports);
// Main Thalia class for easy initialization
class Thalia {
    constructor(options) {
        this.server = new server_1.Server(options);
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
exports.Thalia = Thalia;
//# sourceMappingURL=index.js.map