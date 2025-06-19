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
export * from './thalia.js';
export * from './types.js';
export * from './website.js';
export * from './controllers.js';
export * from './database.js';
export * from './route-guard.js';
//# sourceMappingURL=index.d.ts.map