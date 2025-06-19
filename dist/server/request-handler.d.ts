/**
 * A class based interpretation of the logic from website.ts
 *
 * This class will be more easily testable, and more easily extendable.
 */
/// <reference types="node" resolution-mode="require"/>
import { IncomingMessage, ServerResponse } from 'http';
import { Website } from './website.js';
import { RequestInfo } from './server.js';
export declare class RequestHandler {
    private website;
    constructor(website: Website);
    private req;
    private res;
    private requestInfo;
    private pathname;
    private rootPath;
    private projectPublicPath;
    private projectSourcePath;
    private thaliaSourcePath;
    private thaliaRoot;
    handleRequest(req: IncomingMessage, res: ServerResponse, requestInfo: RequestInfo, pathnameOverride?: string): void;
    private renderError;
    private static getContentType;
    private static tryPublicFile;
    private static tryHandlebars;
    private static tryScss;
    private static tryController;
    private static checkPathExploit;
}
//# sourceMappingURL=request-handler.d.ts.map