import { Thalia } from './thalia';
import { DatabaseInstance } from './core/database';
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
    db?: DatabaseInstance;
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
    private getViews;
    private getScaffoldViews;
}
declare const handle: Thalia.Handle;
export type Views = {
    [key: string]: string;
};
export type ViewCallback = (view: Views) => void;
/**
 * Read a mustache template file
 * Find the scripts and styles
 * Minify and process the javscript and sass
 * Then reinsert them into the template
 *
 * TODO: Process typescript?
 */
export declare function loadMustacheTemplate(file: string): Promise<{
    content: string;
    scripts: string;
    styles: string;
}>;
export { handle, Website };
