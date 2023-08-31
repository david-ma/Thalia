import { Thalia } from './thalia';
declare class Website implements Thalia.WebsiteConfig {
    name: string;
    data: string;
    dist: string;
    cache: boolean;
    folder: string;
    domains: Array<string>;
    workspacePath: string;
    pages: {
        [key: string]: string;
    };
    redirects: {
        [key: string]: string;
    };
    services: Thalia.Services;
    proxies: {
        [key: string]: Thalia.Proxy;
    } | Thalia.rawProxy[];
    sockets: Thalia.Sockets;
    security: {
        loginNeeded: any;
    };
    viewableFolders: boolean | Array<string>;
    seq: Thalia.SequelizeWrapper;
    readAllViews: {
        (callback: ViewCallback): void;
    };
    readTemplate: {
        (config: {
            template: string;
            content: string;
            callback: any;
        }): void;
    };
    views: any;
    controllers: Thalia.Controllers;
    constructor(site: string, config: Thalia.WebsiteConfig);
}
declare const handle: Thalia.Handle;
export type Views = {
    [key: string]: string;
};
export type ViewCallback = (view: Views) => void;
export declare function loadMustacheTemplate(file: string): Promise<{
    content: string;
    scripts: string;
    styles: string;
}>;
export { handle, Website };
