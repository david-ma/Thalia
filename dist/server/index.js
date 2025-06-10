"use strict";
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
exports.startServer = exports.Thalia = void 0;
// Re-export everything from core
__exportStar(require("./core"), exports);
// Export the main Thalia class
var thalia_1 = require("./thalia");
Object.defineProperty(exports, "Thalia", { enumerable: true, get: function () { return thalia_1.Thalia; } });
async function startServer(options = {}) {
    const port = options.port || 3000;
    const project = options.project;
    const server = new Thalia({
        defaultProject: project,
        rootPath: process.cwd()
    });
    await server.start(port);
    console.log(`Server started on port ${port}`);
    if (project) {
        console.log(`Serving project: ${project}`);
    }
}
exports.startServer = startServer;
// Allow running directly from command line
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' && i + 1 < args.length) {
            options.port = parseInt(args[i + 1], 10);
            i++;
        }
        else if (args[i] === '--project' && i + 1 < args.length) {
            options.project = args[i + 1];
            i++;
        }
    }
    startServer(options).catch(err => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map