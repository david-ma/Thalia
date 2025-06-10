import { Thalia } from './core/types'
import { Website } from './core/website'
import { ThaliaServer } from './core/server'
import { RequestHandlers } from './core/handlers'

export class ThaliaApp {
  private server: ThaliaServer
  private websites: Map<string, Website>
  private handlers: RequestHandlers

  constructor(options: Thalia.ServerOptions = {}) {
    this.websites = new Map()
    this.handlers = new RequestHandlers()
    this.server = new ThaliaServer(options)
  }

  public async start(port: number = 3000): Promise<void> {
    await this.server.start(port)
  }

  public async stop(): Promise<void> {
    await this.server.stop()
  }

  public addWebsite(name: string, config: Thalia.WebsiteConfig): void {
    const website = new Website(name, config, process.cwd())
    this.websites.set(name, website)
  }

  public getWebsite(name: string): Website | undefined {
    return this.websites.get(name)
  }
}

// Re-export types
export type { Thalia } from './core/types'

// Re-export core functionality
export { Website } from './core/website'
export { ThaliaServer } from './core/server'
export { RequestHandlers } from './core/handlers'

// Export the legacy code for backward compatibility
export * as ThaliaLegacy from './core/legacy'

export async function startServer(options: { port?: number; project?: string } = {}): Promise<void> {
  const port = options.port || 3000
  const project = options.project

  const server = new ThaliaApp({
    defaultProject: project,
    rootPath: process.cwd()
  })

  await server.start(port)
  console.log(`Server started on port ${port}`)
  if (project) {
    console.log(`Serving project: ${project}`)
  }
}

// Allow running directly from command line
if (require.main === module) {
  const args = process.argv.slice(2)
  const options: { port?: number; project?: string } = {}

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && i + 1 < args.length) {
      options.port = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--project' && i + 1 < args.length) {
      options.project = args[i + 1]
      i++
    }
  }

  startServer(options).catch(err => {
    console.error('Failed to start server:', err)
    process.exit(1)
  })
}
