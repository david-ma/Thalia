/**
 * Website - Website configuration and management
 * 
 * The Website class is responsible for:
 * 1. Managing website configuration
 * 2. Coordinating between Router and Handler
 * 3. Providing website-specific functionality
 * 4. Loading website resources
 * 
 * The Website:
 * - Holds website configuration
 * - Manages website-specific routes
 * - Coordinates request handling
 * - Provides website context
 * 
 * It does NOT handle:
 * - HTTP server setup (handled by Server)
 * - Request routing (handled by Router)
 * - Request processing (handled by Handler)
 */

import { Website as IWebsite, WebsiteConfig, ServerOptions } from './types'
import fs from 'fs'
import path from 'path'
import { IncomingMessage, ServerResponse } from 'http'
import Handlebars from 'handlebars'
import sass from 'sass'

export class Website implements IWebsite {
  public readonly name: string
  public readonly config: WebsiteConfig
  public readonly rootPath: string

  private static handlebars = Handlebars.create()
  public templates: Map<string, Handlebars.TemplateDelegate> = new Map()

  /**
   * Creates a new Website instance
   * @param config - The website configuration
   */
  constructor(config: WebsiteConfig) {
    this.name = config.name
    this.config = config
    this.rootPath = config.rootPath

    // Read all the partials from the partials folder
    const partialsPath = path.join(this.rootPath, 'src', 'partials')
    if (fs.existsSync(partialsPath)) {
      const partials = fs.readdirSync(partialsPath)
      partials.forEach(partial => {
        Website.handlebars.registerPartial(
          partial.replace('.hbs', ''),
          fs.readFileSync(path.join(partialsPath, partial), 'utf8')
        )
      })
    }
  }

  public handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // console.debug("We have a request for: ", req.url)

    // Get the requested file path
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const pathname = url.pathname === '/' ? '/index.html' : url.pathname

    const filePath = path.join(this.rootPath, 'public', pathname)
    const sourcePath = filePath.replace('public', 'src')

    // If we're looking for a css file, check if the scss exists
    if (filePath.endsWith('.css') && fs.existsSync(sourcePath.replace('.css', '.scss'))) {
      const scss = fs.readFileSync(sourcePath.replace('.css', '.scss'), 'utf8')
      const css = sass.renderSync({ data: scss }).css.toString()
      res.writeHead(200, { 'Content-Type': 'text/css' })
      res.end(css)
      return
    }

    const handlebarsTemplate = filePath.replace('.html', '.hbs').replace('public', 'src')
    // Check if the file is a handlebars template
    if (filePath.endsWith('.html') && fs.existsSync(handlebarsTemplate)) {
      const template = fs.readFileSync(handlebarsTemplate, 'utf8')
      const compiledTemplate = Website.handlebars.compile(template)
      const html = compiledTemplate({})
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(html)
      return
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      res.writeHead(404)
      res.end('Not Found')
      return
    }

    // Stream the file
    const stream = fs.createReadStream(filePath)
    stream.on('error', (error) => {
      console.error('Error streaming file:', error)
      res.writeHead(500)
      res.end('Internal Server Error')
    })

    // Set content type based on file extension
    const contentType = this.getContentType(filePath)
    res.setHeader('Content-Type', contentType)

    // Pipe the file to the response
    stream.pipe(res)
  }




  private getContentType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase()
    const contentTypes: { [key: string]: string } = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'text/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'txt': 'text/plain'
    }
    return contentTypes[ext || ''] || 'application/octet-stream'
  }



  /**
   * Loads a website from its configuration
   * @param config - The website configuration
   * @returns Promise resolving to a new Website instance
   */
  public static async load(config: WebsiteConfig): Promise<Website> {
    return new Website(config)
  }


  public static loadAllWebsites(options: ServerOptions): Website[] {
    if (options.mode == 'multiplex') {
      // Check if the root path exists
      // Load all websites from the root path
      const websites = fs.readdirSync(options.rootPath)
      return websites.map(website => new Website({
        name: website,
        rootPath: path.join(options.rootPath, website)
      }))
    }

    return [new Website({
      name: options.project,
      rootPath: options.rootPath
    })]
  }
} 