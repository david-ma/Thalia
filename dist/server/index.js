"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Thalia = exports.Website = exports.Server = void 0;
const process_1 = require("process");
const server_1 = require("./server");
Object.defineProperty(exports, "Server", { enumerable: true, get: function () { return server_1.Server; } });
Object.defineProperty(exports, "Website", { enumerable: true, get: function () { return server_1.Website; } });
const path_1 = __importDefault(require("path"));
// Re-export types
__exportStar(require("./types"), exports);
// Main Thalia class for easy initialization
class Thalia {
    constructor(options) {
        this.websites = server_1.Website.loadAll(options);
        this.server = new server_1.Server(options, websites);
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
const project = process.argv.find(arg => arg.startsWith('--project'))?.split('=')[1] || process.env['PROJECT'] || 'default';
const port = parseInt(process.argv.find(arg => arg.startsWith('--port'))?.split('=')[1] || process.env['PORT'] || '3000');
let options = {
    mode: 'standalone',
    project: project,
    rootPath: (0, process_1.cwd)(),
    port: port
};
if (project == 'default') {
    console.log(`Running in multiplex mode for project`);
    options.mode = 'multiplex';
    options.rootPath = path_1.default.join(options.rootPath, 'websites');
}
else {
    console.log(`Running in standalone mode for project: ${project}`);
    options.mode = 'standalone';
}
const thalia = new Thalia(options);
thalia.start();
//# sourceMappingURL=index.js.map