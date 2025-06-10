"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = void 0;
const server = require("./server");
const router = require("./router");
const requestHandlers = require('./requestHandlers');
const fs = require('fs');
function startServer() {
    const argv = require('minimist')(process.argv.slice(2), {
        string: ['project', 'port'],
        default: {
            port: '1337',
            project: 'default'
        }
    });
    const port = argv.port;
    const project = argv.project;
    const portPattern = /^\d{0,5}$/;
    if (!portPattern.test(port)) {
        console.error('Invalid port number. Must be between 0 and 65535');
        process.exit(1);
    }
    if (!project) {
        console.log('Running in multi-project mode - serving all projects');
        requestHandlers.handle.index.localhost = 'default';
    }
    else {
        if (fs.existsSync(`websites/${project}`)) {
            console.log(`Setting project to websites/${project}`);
            requestHandlers.handle.index.localhost = project;
        }
        else if (fs.existsSync('config.js') || fs.existsSync('config/config.js')) {
            console.log('Thalia running in stand alone mode');
            requestHandlers.handle.index.localhost = project;
        }
        else {
            console.error(`Error: ${project} is an invalid project`);
            process.exit(1);
        }
    }
    requestHandlers.handle.loadAllWebsites();
    server.start(router.router, requestHandlers.handle, port);
}
exports.startServer = startServer;
