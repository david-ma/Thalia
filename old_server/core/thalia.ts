import * as http from 'http'
import * as path from 'path'
import * as fs from 'fs'
import { Socket } from 'socket.io'
import { ThaliaServer } from './server'
import { Website } from './website'
import { RequestHandlers } from './handlers'
import { Thalia as ThaliaTypes } from './types'

export class Thalia {
  private server: ThaliaServer
  private websites: Map<string, Website>
  private handlers: RequestHandlers

  constructor(options: ThaliaTypes.ServerOptions = {}) {
    this.server = new ThaliaServer(options)
    this.websites = new Map()
    this.handlers = new RequestHandlers()
  }

  public async start(port: number, project?: string): Promise<void> {
    // Load website configurations
    const websitesDir = path.join(__dirname, '..', '..', 'websites')
    const projects = project ? [project] : fs.readdirSync(websitesDir)

    for (const projectName of projects) {
      const projectPath = path.join(websitesDir, projectName)
      if (fs.existsSync(projectPath) && fs.statSync(projectPath).isDirectory()) {
        const configPath = path.join(projectPath, 'config.js')
        if (fs.existsSync(configPath)) {
          const config = require(configPath).config as ThaliaTypes.WebsiteConfig
          this.websites.set(projectName, new Website(projectName, config, projectPath))
        }
      }
    }

    if (this.websites.size === 0) {
      throw new Error('No valid websites found to serve')
    }

    // Set up request handling
    this.server.on('request', async (req: http.IncomingMessage, res: http.ServerResponse) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`)
      const words = url.pathname.split('/').filter(Boolean)
      const websiteName = words[0]

      if (this.websites.has(websiteName)) {
        const website = this.websites.get(websiteName)!
        const remainingPath = '/' + words.slice(1).join('/')

        // Handle proxy requests
        if (website.config.proxies) {
          const proxies = Array.isArray(website.config.proxies) 
            ? website.config.proxies 
            : Object.values(website.config.proxies)
          
          for (const proxy of proxies) {
            if (remainingPath.startsWith(proxy.filter || '')) {
              await this.handlers.handleProxyRequest(proxy, req, res)
              return
            }
          }
        }

        // Handle controller requests
        if (website.config.controllers) {
          for (const [path, controller] of Object.entries(website.config.controllers)) {
            if (remainingPath === path) {
              await this.handlers.handleControllerRequest(controller, website, req, res)
              return
            }
          }
        }

        // Handle service requests
        if (website.config.services) {
          for (const [path, service] of Object.entries(website.config.services)) {
            if (remainingPath.startsWith(path)) {
              await this.handlers.handleServiceRequest(service, website, req, res)
              return
            }
          }
        }

        // Handle static files
        await this.handlers.handleStaticRequest(website, remainingPath, req, res)
      } else {
        res.writeHead(404)
        res.end('Website not found')
      }
    })

    // Set up WebSocket handling
    this.server.on('connection', (socket: Socket) => {
      const website = this.server.getWebsiteForSocket(socket)
      if (website) {
        // Handle WebSocket events
        socket.on('message', (data) => {
          // TODO: Implement WebSocket message handling
        })
      }
    })

    // Start the server
    await this.server.start(port)
    console.log(`Server started on port ${port}`)
    console.log('Available websites:', Array.from(this.websites.keys()).join(', '))
  }

  public stop(): void {
    this.server.stop()
  }
} 