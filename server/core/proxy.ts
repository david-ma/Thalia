import { IncomingMessage, ServerResponse } from 'http'
import { createProxyMiddleware } from 'http-proxy-middleware'

export interface ProxyConfig {
  host: string
  port?: number
  path?: string
  filter?: string
  message?: string
  silent?: boolean
}

export class ProxyHandler {
  private configs: Map<string, ProxyConfig>

  constructor() {
    this.configs = new Map()
  }

  public addProxy(domain: string, config: ProxyConfig): void {
    this.configs.set(domain, config)
  }

  public getProxyForHost(host: string): ProxyConfig | null {
    return this.configs.get(host) || null
  }

  public createProxyMiddleware(config: ProxyConfig) {
    return createProxyMiddleware({
      target: `http://${config.host}${config.port ? ':' + config.port : ''}`,
      pathRewrite: config.path ? { [config.path]: '' } : undefined,
      changeOrigin: true,
      logLevel: config.silent ? 'silent' : 'info',
      onError: (err, req, res) => {
        if (config.message) {
          res.writeHead(500, { 'Content-Type': 'text/plain' })
          res.end(config.message)
        } else {
          res.writeHead(500, { 'Content-Type': 'text/plain' })
          res.end('Proxy Error')
        }
      }
    })
  }
} 