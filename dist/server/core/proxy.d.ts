/// <reference types="node" />
import { IncomingMessage, ServerResponse } from 'http';
export interface ProxyConfig {
    host: string;
    port?: number;
    path?: string;
    filter?: string;
    message?: string;
    silent?: boolean;
}
export declare class ProxyHandler {
    private configs;
    constructor();
    addProxy(domain: string, config: ProxyConfig): void;
    getProxyForHost(host: string): ProxyConfig | null;
    createProxyMiddleware(config: ProxyConfig): import("http-proxy-middleware").RequestHandler<IncomingMessage, ServerResponse<IncomingMessage>, (err?: any) => void>;
}
//# sourceMappingURL=proxy.d.ts.map