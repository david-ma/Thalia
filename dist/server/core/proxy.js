"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyHandler = void 0;
const http_proxy_middleware_1 = require("http-proxy-middleware");
class ProxyHandler {
    constructor() {
        this.configs = new Map();
    }
    addProxy(domain, config) {
        this.configs.set(domain, config);
    }
    getProxyForHost(host) {
        return this.configs.get(host) || null;
    }
    createProxyMiddleware(config) {
        return (0, http_proxy_middleware_1.createProxyMiddleware)({
            target: `http://${config.host}${config.port ? ':' + config.port : ''}`,
            pathRewrite: config.path ? { [config.path]: '' } : undefined,
            changeOrigin: true,
            logLevel: config.silent ? 'silent' : 'info',
            onError: (err, req, res) => {
                if (config.message) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end(config.message);
                }
                else {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Proxy Error');
                }
            }
        });
    }
}
exports.ProxyHandler = ProxyHandler;
//# sourceMappingURL=proxy.js.map