/**
 * A class based interpretation of the logic from website.ts
 *
 * This class will be more easily testable, and more easily extendable.
 */
import { IncomingMessage, ServerResponse } from 'http';
import { Website } from './website.js';
import { RequestInfo } from './server.js';
export declare class RequestHandler {
    website: Website;
    constructor(website: Website);
    req: IncomingMessage;
    res: ServerResponse;
    requestInfo: RequestInfo;
    pathname: string;
    private rootPath;
    private projectPublicPath;
    private projectSourcePath;
    private thaliaSourcePath;
    private thaliaRoot;
    handleRequest(req: IncomingMessage, res: ServerResponse, requestInfo: RequestInfo, pathnameOverride?: string): void;
    private renderError;
    private static getContentType;
    private static fileNotFound;
    private static tryStaticFile;
    private static tryHandlebars;
    private static tryScss;
    private static tryController;
    private static checkPathExploit;
}
//# sourceMappingURL=request-handler.d.ts.map