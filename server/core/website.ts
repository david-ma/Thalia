import * as fs from 'fs'
import * as path from 'path'
import * as Handlebars from 'handlebars'
import { Thalia } from './types'

export class Website implements Thalia.Website {
  public readonly name: string
  public readonly config: Thalia.WebsiteConfig
  public readonly rootPath: string
  private views: Map<string, string>
  private handlebars: typeof Handlebars

  constructor(name: string, config: Thalia.WebsiteConfig, rootPath: string) {
    this.name = name
    this.config = this.validateConfig(config)
    this.rootPath = rootPath
    this.views = new Map()
    this.handlebars = Handlebars.create()
  }

  private validateConfig(config: Thalia.WebsiteConfig): Thalia.WebsiteConfig {
    return {
      cache: typeof config.cache === 'boolean' ? config.cache : true,
      folder: typeof config.folder === 'string' 
        ? config.folder 
        : path.resolve(this.rootPath, 'websites', this.name, 'public'),
      workspacePath: typeof config.workspacePath === 'string'
        ? config.workspacePath
        : path.resolve(this.rootPath, 'websites', this.name),
      domains: Array.isArray(config.domains) ? config.domains : [],
      pages: typeof config.pages === 'object' ? config.pages : {},
      redirects: typeof config.redirects === 'object' ? config.redirects : {},
      services: typeof config.services === 'object' ? config.services : {},
      controllers: typeof config.controllers === 'object' ? config.controllers : {},
      proxies: typeof config.proxies === 'object' ? config.proxies : {},
      sockets: typeof config.sockets === 'object' 
        ? config.sockets 
        : { on: [], emit: [] },
      security: typeof config.security === 'object'
        ? config.security
        : {
            loginNeeded: () => false
          },
      viewableFolders: config.viewableFolders || false,
      ...config
    }
  }

  public async loadViews(): Promise<void> {
    const viewsPath = path.join(this.rootPath, 'websites', this.name, 'views')
    if (!fs.existsSync(viewsPath)) {
      return
    }

    const files = await fs.promises.readdir(viewsPath)
    for (const file of files) {
      if (file.endsWith('.hbs')) {
        const content = await fs.promises.readFile(path.join(viewsPath, file), 'utf-8')
        const name = path.basename(file, '.hbs')
        this.views.set(name, content)
        this.handlebars.registerPartial(name, content)
      }
    }
  }

  public async renderTemplate(template: string, data: any): Promise<string> {
    const templateContent = this.views.get(template)
    if (!templateContent) {
      throw new Error(`Template ${template} not found`)
    }

    const compiledTemplate = this.handlebars.compile(templateContent)
    return compiledTemplate(data)
  }

  public getProxyForHost(host: string): Thalia.Proxy | null {
    if (!this.config.proxies) {
      return null
    }

    if (Array.isArray(this.config.proxies)) {
      const proxy = this.config.proxies.find(p => 
        p.domains?.includes(host)
      )
      return proxy || null
    }

    return this.config.proxies[host] || null
  }

  public getControllerForPath(path: string): ((controller: Thalia.Controller) => Promise<void> | void) | null {
    if (!this.config.controllers) {
      return null
    }

    // Remove leading slash and get first path segment
    const pathSegment = path.replace(/^\//, '').split('/')[0]
    return this.config.controllers[pathSegment] || null
  }

  public getServiceForPath(path: string): Thalia.Service | null {
    if (!this.config.services) {
      return null
    }

    // Remove leading slash and get first path segment
    const pathSegment = path.replace(/^\//, '').split('/')[0]
    return this.config.services[pathSegment] || null
  }
} 