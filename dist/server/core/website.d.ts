import { Thalia } from './types';
export declare class Website implements Thalia.Website {
    readonly name: string;
    readonly config: Thalia.WebsiteConfig;
    readonly rootPath: string;
    private views;
    private handlebars;
    constructor(name: string, config: Thalia.WebsiteConfig, rootPath: string);
    private validateConfig;
    loadViews(): Promise<void>;
    renderTemplate(template: string, data: any): Promise<string>;
    getProxyForHost(host: string): Thalia.Proxy | null;
    getControllerForPath(path: string): ((controller: Thalia.Controller) => Promise<void> | void) | null;
    getServiceForPath(path: string): Thalia.Service | null;
}
