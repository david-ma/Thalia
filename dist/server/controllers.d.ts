/**
 * Controllers - Useful shared controller functions for handling requests
 *
 * The controllers are useful functions you can call to do specific tasks on a http request. e.g.
 * 1. Handling requests
 * 2. Rendering templates
 * 3. Handling form submissions
 * 4. Handling file uploads
 */
/// <reference types="node" resolution-mode="require"/>
import { IncomingMessage, ServerResponse } from 'http';
import { Website } from './website.js';
/**
 * Read the latest 10 logs from the log directory
 */
export declare const latestlogs: (res: ServerResponse, _req: IncomingMessage, website: Website) => Promise<void>;
//# sourceMappingURL=controllers.d.ts.map