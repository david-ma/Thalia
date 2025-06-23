/**
 * index.ts - Main entry point for Thalia
 *
 * There are a few ways of running Thalia:
 * standalone, in a project directory:
 *  `npx thalia` this will launch the server in standalone mode, in the current directory
 *  In this case, thalia is an npm package that has been installed there.
 *
 * multiplex.
 * Also `npx thalia`
 * In this case, you have a thalia deployment, with multiple projects in the /websites directory.
 *
 * dev mode.
 * npx thalia --project=PROJECT
 * In this case, you have a thalia deployment, with multiple projects in the /websites directory, and you want to run a specific project.
 *
 * --port=PORT will override the default port of 1337, in any mode
 * PORT and PROJECT can also be set in the environment variables PORT and PROJECT
 */
import { cwd } from 'process';
import path from 'path';
import { Thalia } from './thalia.js';
import fs from 'fs';
const project = process.argv.find((arg) => arg.startsWith('--project'))?.split('=')[1] || process.env['PROJECT'] || 'default';
const port = parseInt(process.argv.find((arg) => arg.startsWith('--port'))?.split('=')[1] || process.env['PORT'] || '1337');
let options = {
    node_env: process.env['NODE_ENV'] || 'development',
    mode: 'standalone',
    project: project,
    rootPath: cwd(),
    port: port,
};
console.log('Checking if websites directory exists at', path.join(options.rootPath, 'websites'));
if (!fs.existsSync(path.join(options.rootPath, 'websites'))) {
    // If there's no websites directory, we're in standalone mode
    options.mode = 'standalone';
    options.project = path.basename(options.rootPath);
}
else if (project == 'default') {
    console.log(`Running in multiplex mode. Loading all projects.`);
    options.mode = 'multiplex';
    options.rootPath = path.join(options.rootPath, 'websites');
}
else {
    console.log(`Running in standalone mode for project: ${project}`);
    options.mode = 'standalone';
    options.rootPath = path.join(options.rootPath, 'websites', project);
}
console.log('Creating Thalia with options:', options);
Thalia.init(options)
    .then((thalia) => {
    thalia.start();
    process.on('SIGINT', () => {
        thalia.stop();
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        thalia.stop();
        process.exit(0);
    });
})
    .catch((error) => {
    console.error('Error starting Thalia:', error);
    process.exit(1);
});
// Export everything from thalia.js
export * from './thalia.js';
// Export models
// export * from '../models/index.js'
// Export security
// export * from './security.js'
export * from './types.js';
export * from './website.js';
export * from './controllers.js';
export * from './database.js';
export * from './route-guard.js';
export * from './security.js';
//# sourceMappingURL=index.js.map