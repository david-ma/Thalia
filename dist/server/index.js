import { cwd } from 'process';
import path from 'path';
import { Thalia } from './thalia.js';
import fs from 'fs';
const project = process.argv.find(arg => arg.startsWith('--project'))?.split('=')[1] || process.env['PROJECT'] || 'default';
const port = parseInt(process.argv.find(arg => arg.startsWith('--port'))?.split('=')[1] || process.env['PORT'] || '1337');
let options = {
    mode: 'standalone',
    project: project,
    rootPath: cwd(),
    port: port
};
console.log("Checking if websites directory exists at", path.join(options.rootPath, 'websites'));
if (!fs.existsSync(path.join(options.rootPath, 'websites'))) {
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
console.log("Creating Thalia with options:", options);
Thalia.create(options).then(thalia => {
    thalia.start();
    process.on('SIGINT', () => {
        thalia.stop();
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        thalia.stop();
        process.exit(0);
    });
}).catch(error => {
    console.error('Error starting Thalia:', error);
    process.exit(1);
});
export * from './thalia.js';
export * from './types.js';
export * from './website.js';
export * from './controllers.js';
export * from './database.js';
//# sourceMappingURL=index.js.map