/**
 * A class based interpretation of the logic from website.ts
 *
 * This class will be more easily testable, and more easily extendable.
 * 
 * Not using WHATWG URL, but consider in future.
 */

import { IncomingMessage, request, ServerResponse } from 'http'
import { Website, type NestedControllerMap } from './website'
import { RequestInfo } from './server'
import path from 'path'
import { dirname } from 'path'
import fs from 'fs'
import * as sass from 'sass'
import zlib from 'zlib'
import { parseMarkdown, wrapMarkdownCodeBlocks, registerMarkdownHelpers } from './markdown'

const GZIP_SIZE_THRESHOLD = 10 * 1024 // 10kb

export class RequestHandler {
  constructor(public website: Website) {
    this.rootPath = this.website.rootPath
  }

  public req!: IncomingMessage
  public res!: ServerResponse
  public requestInfo!: RequestInfo
  public pathname!: string

  private rootPath!: string
  private projectPublicPath!: string
  private projectSourcePath!: string
  private projectDistPath!: string // Just used for the Typescript compiler, might remove this and write to /tmp instead
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
    this.projectDistPath = path.join(this.rootPath, 'dist', path.dirname(this.pathname))

    // Might need a better way to get the thalia root
    this.thaliaRoot = path.join(dirname(import.meta.url).replace('file://', ''), '..')
    this.thaliaSourcePath = path.join(this.thaliaRoot, 'src', this.pathname)

    // Start the request handler chain
    // Check, path exploit, route guard, controller, handlebars, static file, error
    RequestHandler.checkPathExploit(this)
      .then(this.website.routeGuard.handleRequestChain.bind(this.website.routeGuard, this))
      .then(RequestHandler.tryController)
      .then((rh) => RequestHandler.tryStaticFile('dist', rh))
      .then(RequestHandler.tryScss)
      .then(RequestHandler.tryTypescript)
      .then(RequestHandler.tryHandlebars)
      .then(RequestHandler.tryMarkdown)
      .then((rh) => RequestHandler.tryStaticFile('public', rh))
      .then((rh) => RequestHandler.tryStaticFile('docs', rh))
      .then((rh) => RequestHandler.tryStaticFile('data', rh))
      .then((rh) => RequestHandler.tryStaticFile('public', rh, true)) // Serve assets from the thalia root
      .then(RequestHandler.showFolderIndex)
      .then(RequestHandler.fileNotFound)
      .catch((message) => {
        if (typeof message === typeof Error) {
          this.renderError(message)
        }

        console.debug('Successfully finished the request handler chain:', message)
      })
  }

  private renderError(error: Error): void {
    console.error('Trying to render error', error)
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

  private static fileNotFound(requestHandler: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      requestHandler.res.setHeader('Content-Type', 'text/plain')
      requestHandler.res.writeHead(404)
      requestHandler.res.end(Buffer.from('404 Not Found', 'utf8'))
      return finish('404 Not Found')
    })
  }

  private static tryStaticFile(
    folder: string,
    requestHandler: RequestHandler,
    thaliaAsset: boolean = false, // If true, the path is relative to the thalia root
  ): Promise<RequestHandler> {
    let targetPath = path.join(requestHandler.rootPath, folder, requestHandler.pathname)

    if (thaliaAsset) {
      targetPath = path.join(requestHandler.thaliaRoot, folder, requestHandler.pathname)
    }

    return new Promise((next, finish) => {
      // Use the server's configured node_env (same as RequestInfo), not process.env, so tests and
      // embedded servers can set behaviour without mutating global NODE_ENV.
      if (requestHandler.requestInfo.node_env === 'development' && folder === 'dist') {
        if(requestHandler.pathname.endsWith('.js') || requestHandler.pathname.endsWith('.css') || requestHandler.pathname.endsWith('.html')) {
          console.debug('Development mode: Skipping static file', requestHandler.pathname)
          return next(requestHandler)
        }
      }

      const acceptedEncoding = requestHandler.req.headers['accept-encoding'] ?? ''
      const isGzipAccepted = acceptedEncoding.includes('gzip')

      if (!fs.existsSync(targetPath)) {
        if (isGzipAccepted && fs.existsSync(`${targetPath}.gz`)) {
          targetPath += '.gz'
          requestHandler.res.setHeader('Content-Encoding', 'gzip')
          requestHandler.res.setHeader('Content-Type', RequestHandler.getContentType(targetPath))
          requestHandler.res.setHeader('Content-Length', fs.statSync(targetPath).size.toString())

          const stream = fs.createReadStream(targetPath)
          stream.pipe(requestHandler.res)
          return finish(`Successfully streamed pre-gzipped file ${requestHandler.pathname}`)
        } else {
          next(requestHandler)
          return
        }
      }

      const contentType = RequestHandler.getContentType(requestHandler.pathname)
      requestHandler.res.setHeader('Content-Type', contentType)
      const gzippable = ['text/html', 'text/css', 'text/javascript', 'application/json', 'image/svg+xml']

      if (fs.statSync(targetPath).isDirectory()) {
        const indexPath = path.join(requestHandler.pathname, 'index.html')
        requestHandler.handleRequest(requestHandler.req, requestHandler.res, requestHandler.requestInfo, indexPath)
        return finish(`Redirected to ${indexPath}`)
      } else if (
        gzippable.includes(contentType) &&
        isGzipAccepted &&
        fs.statSync(targetPath).size > GZIP_SIZE_THRESHOLD
      ) {
        const inputFile = fs.readFileSync(targetPath)
        zlib.gzip(inputFile, (err, result) => {
          if (err) {
            console.error('Error gzipping file:', err)
            requestHandler.res.writeHead(500)
            requestHandler.res.end('Internal Server Error')
            return finish('Error gzipping file')
          }

          requestHandler.res.writeHead(200, {
            'Content-Encoding': 'gzip',
            'Content-Length': result.length.toString(),
            'Content-Type': contentType,
          })
          requestHandler.res.end(result)
          return finish(`Successfully gzipped file ${requestHandler.pathname}`)
        })
      } else {
        const stream = fs.createReadStream(targetPath)
        stream.on('error', (error) => {
          console.error('Error streaming file:', error)
          requestHandler.res.writeHead(500)
          requestHandler.res.end('Internal Server Error')
          return finish('Error streaming file')
        })
        stream.on('end', () => {
          requestHandler.res.end()
          return finish(`Successfully streamed file ${requestHandler.pathname}`)
        })
        stream.pipe(requestHandler.res)
      }
    })
  }

  /**
   * Tries to render handlebars templates from <PROJECT_DIR>/src
   * Partials are loaded using loadPartials() from website.ts
   *
   * If there is a handlebars template matching the incoming path, we render it.
   * We look for the template in the following order:
   *
   * <PROJECT_DIR>/src/pathname.hbs // This is the project's own template
   * <THALIA_ROOT>/src/pathname.hbs // This is the thalia default template
   *
   * Note that .mustache and .hbs files are both ingested as partials.
   *
   * In future, we could serve anything with .hbs after it, e.g. data.json.hbs or test.js.hbs
   * But this is not required yet so we have not implemented it.
   * 
   * Note that because we put partials under src, it is possible to visit /views/partials/input.hbs and it will be served as html.
   * This might not be desirable, but it probably isn't a security risk or problem.
   * To fix this, we could move the partials to a separate folder, and only put handlebars files that we want to be served as full views in a folder called views.
   * But this would overcomplicate the system and give the developer too many folders to manage.
   * So we will leave it as is for now.
   * 
   * All .hbs files in the src folder can be served as html. And all .hbs files are loaded as partials.
   * The folder names are just to help with the mental model of the website.
   */
  private static tryHandlebars(requestHandler: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      let pathname = requestHandler.pathname

      // If the request is for a template in a partial folder, do not render it
      // Partials should not be rendered directly like this.
      if (pathname.includes('/partials/')) {
        return next(requestHandler)
      }

      // If pathname is a directory, try <directory>/index.html
      if (fs.existsSync(path.join(requestHandler.rootPath, 'src', pathname, 'index.hbs'))) {
        pathname = path.join(pathname, 'index.html')
      } else if (
        // Or try and see if there is a <pathname>.hbs file
        fs.existsSync(path.join(requestHandler.rootPath, 'src', pathname + '.hbs'))
      ) {
        pathname = pathname + '.html'
      }

      if (!pathname.endsWith('.html')) {
        return next(requestHandler)
      }

      // Serve hbs file in src as if it were html
      const handlebarsPath = path.join(requestHandler.rootPath, 'src', pathname.replace('.html', '.hbs'))
      const thaliaHandlebarsPath = path.join(requestHandler.thaliaRoot, 'src', pathname.replace('.html', '.hbs'))
      let target: string | null = null

      if (fs.existsSync(handlebarsPath) && fs.statSync(handlebarsPath).isFile()) {
        target = handlebarsPath
      } else if (fs.existsSync(thaliaHandlebarsPath) && fs.statSync(thaliaHandlebarsPath).isFile()) {
        target = thaliaHandlebarsPath
      }

      if (target && target.endsWith('.hbs') && fs.statSync(target).isFile()) {
        requestHandler.website
          .asyncServeHandlebarsTemplate({
            res: requestHandler.res,
            templatePath: target,
            data: {
              requestInfo: requestHandler.requestInfo,
              version: requestHandler.website.version,
            }, // Or send an empty object?
          })
          .then(() => {
            finish(`Successfully rendered handlebars template ${requestHandler.pathname}`)
          })
      } else {
        return next(requestHandler)
      }
    })
  }

  /** When no index is found and path is a directory under src/, render folder listing (development only). */
  private static showFolderIndex(requestHandler: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      // console.debug("showFolderIndex: We are at this path: ", requestHandler.pathname)

      if (requestHandler.requestInfo.node_env !== 'development') return next(requestHandler)

      const data = RequestHandler.resolveFolderIndexData(requestHandler)
      if (!data) return next(requestHandler)

      const partialPath = path.join(requestHandler.thaliaRoot, 'src', 'views', 'partials', 'show_folder_index.hbs')
      if (!fs.existsSync(partialPath)) return next(requestHandler)

      const contentHtml = requestHandler.website.handlebars.compile(fs.readFileSync(partialPath, 'utf8'))(data)
      const html = RequestHandler.renderFolderIndexWrapper(requestHandler, contentHtml, data.title)
      requestHandler.res.writeHead(200, { 'Content-Type': 'text/html' })
      requestHandler.res.end(html)
      finish(`Successfully rendered folder index ${requestHandler.pathname}`)
    })
  }

  private static resolveFolderIndexData(rh: RequestHandler): { pathname: string; basePath: string; entries: { name: string; isDirectory: boolean }[]; parentPath: string; title: string } | null {
    const dirPath = path.join(rh.rootPath, 'src', RequestHandler.decodePathnameForFilesystemLookup(rh.pathname) ?? '')
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return null
    let names: string[]
    try {
      names = fs.readdirSync(dirPath).filter((n) => n !== '.DS_Store')
    } catch {
      return null
    }
    const pathname = rh.pathname.replace(/\/$/, '') || ''
    const basePath = pathname ? pathname + '/' : ''
    const entries = names
      .map((name) => ({ name, isDirectory: fs.statSync(path.join(dirPath, name)).isDirectory() }))
      .sort((a, b) => (a.isDirectory !== b.isDirectory ? (a.isDirectory ? -1 : 1) : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })))

    // Very unix centric. Might have unexpected behaviour on Windows.
    const parentPath = pathname.includes('/') ? pathname.replace(/\/[^/]*$/, '') : ''
    const title = dirPath.split('/').pop() ?? ''
    return { pathname, basePath, entries, parentPath, title }
  }

  private static renderFolderIndexWrapper(rh: RequestHandler, contentHtml: string, title: string): string {
    if (rh.website.env === 'development') rh.website.loadPartials()
    rh.website.handlebars.registerPartial('content', contentHtml)
    let wrapper = rh.website.handlebars.partials['wrapper'] ?? ''
    if (rh.website.env === 'development') wrapper = wrapper.replace('</body>', '{{> browsersync }}\n</body>')
    return rh.website.handlebars.compile(wrapper)({ requestInfo: rh.requestInfo, version: rh.website.version, title })
  }

  /** Serve src/path.md or src/path/index.md via wrapper (same path rules as tryHandlebars). */
  private static tryMarkdown(requestHandler: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      const target = RequestHandler.resolveMarkdownPath(requestHandler)
      if (!target) return next(requestHandler)

      fs.promises
        .readFile(target, 'utf8')
        .then((content) => {
          const mermaidSources: string[] = []
          const contentHtml = wrapMarkdownCodeBlocks(parseMarkdown(content), mermaidSources)
          registerMarkdownHelpers(requestHandler.website.handlebars)
          let html: string
          try {
            html = RequestHandler.renderMarkdownWrapper(requestHandler, contentHtml, mermaidSources)
          } catch (error) {
            console.debug("Error rendering markdown: ", error)
            console.debug("Replacing {{ and }} with &#123;&#123; and &#125;&#125;")
            html = RequestHandler.renderMarkdownWrapper(requestHandler,
              contentHtml.replace(/{{/g, '&#123;&#123;').replace(/}}/g, '&#125;&#125;'), 
              mermaidSources)
          }
          requestHandler.res.writeHead(200, { 'Content-Type': 'text/html' })
          requestHandler.res.end(html)
          finish(`Successfully rendered markdown ${requestHandler.pathname}`)
        })
        .catch((err) => {
          console.error(`Error serving markdown ${requestHandler.pathname}:`, err)
          requestHandler.res.writeHead(500)
          requestHandler.res.end('Internal Server Error')
          finish('Error serving markdown file')
        })
    })
  }

  /**
   * Decode %XX in each path segment so filesystem paths match real names (e.g. Obsidian folders with spaces).
   * Per-segment decode avoids %2F becoming an extra path level; reject .. after decode (incl. %2e%2e).
   */
  private static decodePathnameForFilesystemLookup(pathname: string): string | null {
    const normalized = pathname.replace(/\/$/, '') || ''
    if (!normalized) return ''
    const segments = normalized.split('/').filter(Boolean)
    const out: string[] = []
    for (const seg of segments) {
      let decoded: string
      try {
        decoded = decodeURIComponent(seg)
      } catch {
        return null
      }
      if (decoded === '..' || decoded === '') return null
      out.push(decoded)
    }
    return out.join('/')
  }

  // TODO: /index.html should try /index.md
  private static resolveMarkdownPath(rh: RequestHandler): string | null {
    const p = RequestHandler.decodePathnameForFilesystemLookup(rh.pathname)
    if (p === null) return null
    const mdCandidates = [
      path.join(p, 'index.md'),
      p.endsWith('.md') ? p : p + '.md',
    ]
    for (const mdPath of mdCandidates) {
      const project = path.join(rh.rootPath, 'src', mdPath)
      const thalia = path.join(rh.thaliaRoot, 'src', mdPath)
      if (fs.existsSync(project) && fs.statSync(project).isFile()) return project
      if (fs.existsSync(thalia) && fs.statSync(thalia).isFile()) return thalia
    }
    return null
  }

  private static renderMarkdownWrapper(rh: RequestHandler, contentHtml: string, mermaidSources: string[]): string {
    if (rh.website.env === 'development') rh.website.loadPartials()
    rh.website.handlebars.registerPartial('content', contentHtml)
    let wrapper = rh.website.handlebars.partials['wrapper'] ?? '{{> content }}'
    if (rh.website.env === 'development') wrapper = wrapper.replace('</body>', '{{> browsersync }}\n</body>')
    wrapper = wrapper.replace('</body>', '{{> markdown_processing }}\n</body>')
    return rh.website.handlebars.compile(wrapper)({
      requestInfo: rh.requestInfo,
      version: rh.website.version,
      mermaidSources,
    })
  }

  /**
   * If we have a typescript file, we try to compile it to javascript.
   * Sideeffect: This will create the javascript file in /dist
   * We could create the javsacript file in /tmp instead
   * Or we could upgrade the tryScss to also create the css file in /dist, so it matches
   * Either way, we should aim to be consistent.
   */
  private static tryTypescript(requestHandler: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      if (!requestHandler.pathname.endsWith('.js')) {
        return next(requestHandler)
      }

      const tsPath = requestHandler.projectSourcePath.replace('.js', '.ts')
      if (fs.existsSync(tsPath)) {
        // create dist folder if it doesn't exist
        fs.mkdirSync(requestHandler.projectDistPath, { recursive: true })
        Bun.build({
          entrypoints: [tsPath],
          target: 'browser',
          outdir: requestHandler.projectDistPath // Perhaps we should write to /tmp instead
        }).then((result) => {
          const jsPath = result.outputs[0].path
          return Bun.file(jsPath).text()
        }).then((jsText) => {
          requestHandler.res.writeHead(200, { 'Content-Type': 'text/javascript' })
          requestHandler.res.end(jsText)
          return finish(`Successfully compiled typescript file ${requestHandler.pathname}`)
        }).catch((error) => {
          // Fall back to next handler so pre-built assets (e.g. public/js/*.js)
          // can be served when Bun.build fails (e.g. three/examples/jsm).
          console.error('TypeScript compile failed, falling back:', requestHandler.pathname, error)
          return next(requestHandler)
        })
      } else {
        return next(requestHandler)
      }
    })
  }

  /**
   * This should work in the same way as tryTypescript, but for scss files.
   * So it should save the file in the correct dist folder.
   */
  private static tryScss(requestHandler: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      if (!requestHandler.pathname.endsWith('.css')) {
        return next(requestHandler)
      }

      const scssPath = requestHandler.projectSourcePath.replace('.css', '.scss')
      const thaliaScssPath = requestHandler.thaliaSourcePath.replace('.css', '.scss')
      let target: string | null = null

      if (fs.existsSync(scssPath)) {
        target = scssPath
      } else if (fs.existsSync(thaliaScssPath)) {
        target = thaliaScssPath
      }

      if (target) {
        const css = sass.compile(target).css.toString()
        const cssPath = path.join(requestHandler.rootPath, 'dist', requestHandler.pathname)
        fs.mkdirSync(path.dirname(cssPath), { recursive: true })
        fs.writeFileSync(cssPath, css)
        console.debug('Successfully compiled scss file', requestHandler.pathname)
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
      const pathname = requestHandler.pathname ?? ''
      let segments = pathname.split('/').filter(Boolean)
      if (segments.length === 0) {
        segments = [requestHandler.requestInfo.controller]
      }

      let node: NestedControllerMap = requestHandler.website.controllers
      for (const segment of segments) {
        if (typeof node === 'function') {
          node(requestHandler.res, requestHandler.req, requestHandler.website, requestHandler.requestInfo)
          return finish(`Successfully executed controller ${requestHandler.requestInfo.controller}`)
        }
        if (node === null || typeof node !== 'object' || !(segment in node)) {
          return next(requestHandler)
        }
        node = (node as Record<string, NestedControllerMap>)[segment]
      }

      if (typeof node === 'function') {
        node(requestHandler.res, requestHandler.req, requestHandler.website, requestHandler.requestInfo)
        return finish(`Successfully executed controller ${requestHandler.requestInfo.controller}`)
      }
      return next(requestHandler)
    })
  }

   // This checks if the path contains a .. segment, and if so, it returns a 400 Bad Request.
  private static checkPathExploit(requestHandler: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      const parts = requestHandler.pathname.split('/')
      if (parts.some((part) => part === '..')) {
        requestHandler.res.writeHead(400)
        requestHandler.res.end('Bad Request')
        return finish('Successfully blocked path exploit')
      }
      return next(requestHandler)
    })
  }
}
