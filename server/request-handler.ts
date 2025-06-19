/**
 * A class based interpretation of the logic from website.ts
 * 
 * This class will be more easily testable, and more easily extendable.
 */

import { IncomingMessage, request, ServerResponse } from 'http'
import { Website } from './website.js'
import { RequestInfo } from './server.js'
import path from 'path'
import { dirname } from 'path'
import fs from 'fs'
import * as sass from 'sass'

export class RequestHandler {
  constructor(private website: Website) {
    this.rootPath = this.website.rootPath
  }

  private req!: IncomingMessage
  private res!: ServerResponse
  private requestInfo!: RequestInfo
  private pathname!: string


  private rootPath!: string
  private projectPublicPath!: string
  private projectSourcePath!: string
  private thaliaSourcePath!: string
  private thaliaRoot!: string
  


  public handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
    requestInfo: RequestInfo,
    pathnameOverride?: string,
  ): void {
    this.req = req
    this.res = res
    this.requestInfo = requestInfo
    this.pathname = pathnameOverride ?? requestInfo.pathname

    this.projectPublicPath = path.join(this.rootPath, 'public', this.pathname)
    this.projectSourcePath = this.projectPublicPath.replace('public', 'src')
    this.thaliaRoot = path.join(dirname(import.meta.url).replace('file://', ''), '..', '..')
    this.thaliaSourcePath = path.join(this.thaliaRoot, 'src', this.pathname)

    // Start the request handler chain
    // Check, path exploit, route guard, controller, handlebars, static file, error
    RequestHandler.checkPathExploit(this)
      .then(this.website.routeGuard.handleRequestChain)
      .then(RequestHandler.tryController)
      .then(RequestHandler.tryScss)
      .then(RequestHandler.tryHandlebars)
      .then(RequestHandler.tryPublicFile)
      // .then(this.tryStaticFile)
      // .then(this.tryError)
      .catch((message) => {
        if (typeof message === typeof Error) {
          this.renderError(message)
        }

        console.debug("Successfully finished the request handler chain", message)
      })
  }

  private renderError(error: Error): void {
    this.website.renderError(this.res, error)
  }

  private static getContentType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase()
    const contentTypes: { [key: string]: string } = {
      html: 'text/html',
      css: 'text/css',
      js: 'text/javascript',
      json: 'application/json',
      png: 'image/png',
      jpg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      ico: 'image/x-icon',
      webp: 'image/webp',
      woff: 'font/woff',
      woff2: 'font/woff2',
      ttf: 'font/ttf',
      eot: 'font/eot',
      otf: 'font/otf',
    }
    return contentTypes[ext ?? ''] || 'application/octet-stream'
  }

  // TODO: Implement this
  // private setSafeHeaders(headers: Record<string, string>): void {
  //   // Check if headers have not been set yet
  //   if(this.res.headersSent) {
  //     return
  //   }

  //   Object.entries(headers).forEach(([key, value]) => {
  //     this.res.setHeader(key, value)
  //   })
  // }


  private static tryPublicFile(requestHandler: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      if (!fs.existsSync(requestHandler.projectPublicPath)) {
        next(requestHandler)
        return
      }

      if (fs.statSync(requestHandler.projectPublicPath).isDirectory()) {
        const indexPath = path.join(requestHandler.pathname, 'index.html')
        requestHandler.handleRequest(requestHandler.req, requestHandler.res, requestHandler.requestInfo, indexPath)
        return finish(`Redirected to ${requestHandler.pathname}/index.html`)
      } else {
        const contentType = RequestHandler.getContentType(requestHandler.pathname)
        requestHandler.res.setHeader('Content-Type', contentType)
        const stream = fs.createReadStream(requestHandler.projectPublicPath)
        stream.on('error', (error) => {
          console.error('Error streaming file:', error)
          requestHandler.res.writeHead(500)
          requestHandler.res.end('Internal Server Error')
          return finish("Error streaming file")
        })
        stream.on('end', () => {
          requestHandler.res.end()
          return finish(`Successfully streamed file ${requestHandler.pathname}`)
        })
        stream.pipe(requestHandler.res)        
      }
    })
  }


  private static tryHandlebars(requestHandler: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      if (!requestHandler.pathname.endsWith('.html')) {
        return next(requestHandler)
      }

      const handlebarsPath = requestHandler.projectSourcePath.replace('.html', '.hbs')
      const thaliaHandlebarsPath = requestHandler.thaliaSourcePath.replace('.html', '.hbs')
      let target = null

      if (fs.existsSync(handlebarsPath)) {
        target = handlebarsPath
      } else if (fs.existsSync(thaliaHandlebarsPath)) {
        target = thaliaHandlebarsPath
      }

      if (target) {
        const template = fs.readFileSync(target, 'utf8')
        const html = requestHandler.website.handlebars.compile(template)(requestHandler.requestInfo)
        requestHandler.res.writeHead(200, { 'Content-Type': 'text/html' })
        requestHandler.res.end(html)
        return finish(`Successfully rendered handlebars template ${requestHandler.pathname}`)
      } else {
        return next(requestHandler)
      }
    })
  }

  private static tryScss(requestHandler: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      if (!requestHandler.pathname.endsWith('.css')) {
        return next(requestHandler)
      }

      const scssPath = requestHandler.projectSourcePath.replace('.css', '.scss')
      const thaliaScssPath = requestHandler.thaliaSourcePath.replace('.css', '.scss')
      let target = null

      if (fs.existsSync(scssPath)) {
        target = scssPath
      } else if (fs.existsSync(thaliaScssPath)) {
        target = thaliaScssPath
      }

      if (target) {
        const css = sass.compile(target).css.toString()
        requestHandler.res.writeHead(200, { 'Content-Type': 'text/css' })
        requestHandler.res.end(css)
        return finish(`Successfully compiled scss file ${requestHandler.pathname}`)
      } else {
        return next(requestHandler)
      }
    })
  }


  private static tryController(requestHandler: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      const controllerSlug = requestHandler.requestInfo.controller
      const controller = requestHandler.website.controllers[controllerSlug]
      if (!controller) {
        return next(requestHandler)
      } else {
        controller(requestHandler.res, requestHandler.req, requestHandler.website, requestHandler.requestInfo)
        return finish(`Successfully executed controller ${requestHandler.requestInfo.controller}`)
      }
    })
  }

  private static checkPathExploit(requestHandler: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      const parts = requestHandler.pathname.split('/')
      if (parts.some((part) => part === '..')) {
        requestHandler.res.writeHead(400)
        requestHandler.res.end('Bad Request')
        return finish("Successfully blocked path exploit")
      }
      return next(requestHandler)
    })
  }
}
