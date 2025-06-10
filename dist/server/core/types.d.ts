export type ServerMode = 'standalone' | 'multiplex' | 'dev';
export interface ServerOptions {
    port: number;
    mode: ServerMode;
    rootPath?: string;
}
export interface WebsiteConfig {
    name: string;
    rootPath: string;
}
export interface Website {
    readonly name: string;
    readonly config: WebsiteConfig;
    readonly rootPath: string;
}
//# sourceMappingURL=types.d.ts.map