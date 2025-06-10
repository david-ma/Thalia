import * as http from 'http'
import * as path from 'path'
import * as fs from 'fs'
import { EventEmitter } from 'events'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { Thalia } from './types'
import { Website } from './website'

export class ThaliaServer extends EventEmitter {
  private readonly websites: Map<string, Website>
  private readonly currentProject: string
  private readonly rootPath: string
  private readonly blacklist: string[]
  private httpServer: http.Server | null
  private socketServer: SocketIOServer | null

  constructor(options: Thalia.ServerOptions = {}) {
    super()
    this.websites = new Map()
    this.currentProject = options.defaultProject || 'default'
    this.rootPath = options.rootPath || process.cwd()
    this.blacklist = options.blacklist || []
    this.httpServer = null
    this.socketServer = null
  }

  public async start(port: number): Promise<void> {
    await this.loadWebsites()
    this.setupHttpServer(port)
    this.setupSocketServer()
  }

  public async stop(): Promise<void> {
    if (this.socketServer) {
      this.socketServer.close()
    }
    if (this.httpServer) {
      this.httpServer.close()
    }
  }

  public getWebsiteForSocket(socket: Socket): Website | null {
    const host = socket.handshake.headers.host?.split(':')[0]
    return host ? this.getWebsiteForHost(host) : null
  }

  private async loadWebsites(): Promise<void> {
    if (this.currentProject === 'default') {
      await this.loadAllProjects()
    } else {
      await this.loadSingleProject(this.currentProject)
    }
  }

  private async loadAllProjects(): Promise<void> {
    const websitesPath = path.join(this.rootPath, 'websites')
    if (!fs.existsSync(websitesPath)) {
      console.log('No websites directory found')
      return
    }

    const projects = await fs.promises.readdir(websitesPath)
    for (const project of projects) {
      const projectPath = path.join(websitesPath, project)
      if ((await fs.promises.stat(projectPath)).isDirectory()) {
        await this.loadSingleProject(project)
      }
    }
  }

  private async loadSingleProject(project: string): Promise<void> {
    const configPath = path.join(this.rootPath, 'websites', project, 'config.js')
    let config: Thalia.WebsiteConfig = {}

    try {
      if (fs.existsSync(configPath)) {
        config = require(configPath).config
      }
    } catch (err) {
      console.error(`Error loading config for ${project}:`, err)
    }

    const website = new Website(project, config, this.rootPath)
    await website.loadViews()
    this.websites.set(project, website)
  }

  private setupHttpServer(port: number): void {
    this.httpServer = http.createServer((req, res) => {
      this.emit('request', req, res)
    })
    this.httpServer.listen(port, () => {
      console.log(`Server started on port ${port}`)
    })
  }

  private setupSocketServer(): void {
    if (!this.httpServer) {
      throw new Error('HTTP server must be initialized before socket server')
    }

    this.socketServer = new SocketIOServer(this.httpServer)
    this.setupSocketHandlers()
  }

  private setupSocketHandlers(): void {
    if (!this.socketServer) return

    this.socketServer.on('connection', (socket) => {
      this.emit('connection', socket)
    })
  }

  private getWebsiteForHost(host: string): Website | null {
    for (const website of this.websites.values()) {
      if (website.config.domains?.includes(host)) {
        return website
      }
    }
    return this.websites.get(this.currentProject) || null
  }
} 