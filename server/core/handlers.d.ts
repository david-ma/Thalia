/// <reference types="node" />
import * as http from 'http';
import { Thalia } from './types';
import { Website } from './website';
export declare class RequestHandlers {
    private readonly proxyServer;
    constructor();
    handleProxyRequest(proxy: Thalia.Proxy, req: http.IncomingMessage, res: http.ServerResponse): Promise<void>;
    handleControllerRequest(controller: (controller: Thalia.Controller) => Promise<void> | void, website: Website, req: http.IncomingMessage, res: http.ServerResponse): Promise<void>;
    handleServiceRequest(service: Thalia.Service, website: Website, req: http.IncomingMessage, res: http.ServerResponse): Promise<void>;
    handleStaticRequest(website: Website, pathname: string, req: http.IncomingMessage, res: http.ServerResponse): Promise<void>;
    private handleLoginPage;
    private getCookies;
    private encode;
    private generateDirectoryListing;
    private readonly simpleLoginPage;
}
