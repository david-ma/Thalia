/**
 * A class based interpretation of the logic from website.ts
 *
 * This class will be more easily testable, and more easily extendable.
 *
 * Not using WHATWG URL, but consider in future.
 */

import { IncomingMessage, ServerResponse } from 'http'
import { fileURLToPath } from 'url'
import { Website, compileHandlebarsTemplate, type Controller, type NestedControllerMap } from './website'
import { RequestInfo } from './server'
import path from 'path'
import { dirname } from 'path'
import fs from 'fs'
import * as sass from 'sass'
import zlib from 'zlib'
import { renderMarkdownPage } from './markdown'
import { TemplateError } from './errors'
import {
  GZIP_SIZE_THRESHOLD,
  getContentType,
  hasRangeHeader,
  isGzipFriendlyMime,
  setStaticFileHeaders,
  streamStaticFile,
} from './static-files'

export {
  GZIP_SIZE_THRESHOLD,
  getContentType,
  mimeBaseType,
  isGzipFriendlyMime,
  inlineContentTypes,
  contentDispositionInline,
  setStaticFileHeaders,
  parseBytesRange,
  hasRangeHeader,
  streamStaticFile,
} from './static-files'
export type { ParsedByteRange } from './static-files'

const THALIA_SASS_OPTIONS = {
  silenceDeprecations: Array.from([
    'import',
    'global-builtin',
    'color-functions',
    'if-function',
    'slash-div',
  ]),
} as sass.Options<"sync">;

type FolderIndexEntry = {
  name: string
  isDirectory: boolean
}

type FolderIndexData = {
  pathname: string
  basePath: string
  entries: FolderIndexEntry[]
  parentPath: string
  title: string
}

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
    this.projectSourcePath = path.join(this.rootPath, 'src', this.pathname)
    this.projectDistPath = path.join(this.rootPath, 'dist', path.dirname(this.pathname))

    this.thaliaRoot = path.join(dirname(fileURLToPath(import.meta.url)), '..')
    this.thaliaSourcePath = path.join(this.thaliaRoot, 'src', this.pathname)

    // Handler chain: path exploit → route guard → controller → dist → scss → ts → hbs → pdf → md → csv
    // → public → docs → data → thalia public → folder index (dev) → 404
    // Same URL stem: pdf (in public/…) wins over markdown (src/…) when both exist.
    RequestHandler.checkPathExploit(this)
      .then(this.website.routeGuard.handleRequestChain.bind(this.website.routeGuard, this))
      .then(RequestHandler.tryController)
      .then((rh) => RequestHandler.tryStaticFile('dist', rh))
      .then(RequestHandler.tryScss)
      .then(RequestHandler.tryTypescript)
      .then(RequestHandler.tryHandlebars)
      .then(RequestHandler.tryPdf)
      .then(RequestHandler.tryMarkdown)
      .then(RequestHandler.tryCsv)
      .then(RequestHandler.showFolderIndex)
      .then((rh) => RequestHandler.tryStaticFile('public', rh))
      .then((rh) => RequestHandler.tryStaticFile('docs', rh))
      .then((rh) => RequestHandler.tryStaticFile('data', rh))
      .then((rh) => RequestHandler.tryStaticFile('public', rh, true)) // Serve assets from the thalia root
      .then(RequestHandler.fileNotFound)
      .catch((message) => {
        if (message instanceof Error) {
          this.renderError(message)
          return
        }

        console.debug('Successfully finished the request handler chain:', message)
      })
  }

  private renderError(error: Error): void {
    console.error('Trying to render error', error)
    this.website.renderError(this.res, error)
  }

  /** Project folders searched for PDFs (first match wins). */
  private static readonly pdfStaticFolders = ['public', 'data', 'dist', 'docs'] as const

  /** Project folders eligible for development directory listings (first match wins). */
  private static readonly folderIndexFolders = ['docs', 'src'] as const

  /** Decoded safe relative path for filesystem lookups, or null if invalid. */
  private static filesystemRelativePath(pathname: string): string | null {
    return RequestHandler.decodePathnameForFilesystemLookup(pathname)
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
    return new Promise((next, finish) => {
      const rel = RequestHandler.filesystemRelativePath(requestHandler.pathname)
      if (rel === null) return next(requestHandler)

      const baseRoot = thaliaAsset ? requestHandler.thaliaRoot : requestHandler.rootPath
      let targetPath = path.join(baseRoot, folder, rel)
      // Use the server's configured node_env (same as RequestInfo), not process.env, so tests and
      // embedded servers can set behaviour without mutating global NODE_ENV.
      if (requestHandler.requestInfo.node_env === 'development' && folder === 'dist') {
        if (
          requestHandler.pathname.endsWith('.js') ||
          requestHandler.pathname.endsWith('.css') ||
          requestHandler.pathname.endsWith('.html')
        ) {
          console.debug('Development mode: Skipping static file', requestHandler.pathname)
          return next(requestHandler)
        }
      }

      const acceptedEncoding = requestHandler.req.headers['accept-encoding'] ?? ''
      const isGzipAccepted = acceptedEncoding.includes('gzip')
      // Range + gzip is messy: skip on-the-fly gzip when Range is present.
      // Precompressed `.gz` sidecars: if only the sidecar exists, ignore Range and serve the full
      // gzip body (current behaviour). Range applies only to uncompressed on-disk files.
      const wantsRange = hasRangeHeader(requestHandler.req)

      if (!fs.existsSync(targetPath)) {
        if (isGzipAccepted && fs.existsSync(`${targetPath}.gz`)) {
          targetPath += '.gz'
          requestHandler.res.setHeader('Content-Encoding', 'gzip')
          // MIME from the logical URL (e.g. .json), not the on-disk .gz name (would be octet-stream).
          const logicalContentType = getContentType(requestHandler.pathname)
          setStaticFileHeaders(
            requestHandler.res,
            requestHandler.pathname,
            logicalContentType,
          )
          requestHandler.res.setHeader('Content-Length', fs.statSync(targetPath).size.toString())

          const stream = fs.createReadStream(targetPath)
          stream.pipe(requestHandler.res)
          return finish(`Successfully streamed pre-gzipped file ${requestHandler.pathname}`)
        } else {
          next(requestHandler)
          return
        }
      }

      const contentType = getContentType(requestHandler.pathname)
      setStaticFileHeaders(
        requestHandler.res,
        requestHandler.pathname,
        contentType
      )
      if (fs.statSync(targetPath).isDirectory()) {
        const indexPath = path.join(requestHandler.pathname, 'index.html')
        requestHandler.handleRequest(requestHandler.req, requestHandler.res, requestHandler.requestInfo, indexPath)
        return finish(`Redirected to ${indexPath}`)
      } else if (
        !wantsRange &&
        isGzipFriendlyMime(contentType) &&
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
        streamStaticFile(
          requestHandler.req,
          requestHandler.res,
          targetPath,
          finish,
          `file ${requestHandler.pathname}`,
        )
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
      const rel = RequestHandler.filesystemRelativePath(requestHandler.pathname)
      if (rel === null) return next(requestHandler)

      let pathname = rel

      // If the request is for a template in a partial folder, do not render it
      // Partials should not be rendered directly like this.
      if (pathname.includes('/partials/')) {
        return next(requestHandler)
      }

      const projectIndexHbs = path.join(requestHandler.rootPath, 'src', pathname, 'index.hbs')
      const thaliaIndexHbs = path.join(requestHandler.thaliaRoot, 'src', pathname, 'index.hbs')
      const projectPageHbs = path.join(requestHandler.rootPath, 'src', pathname + '.hbs')
      const thaliaPageHbs = path.join(requestHandler.thaliaRoot, 'src', pathname + '.hbs')

      // If pathname is a directory, try <directory>/index.html
      if (fs.existsSync(projectIndexHbs) || fs.existsSync(thaliaIndexHbs)) {
        pathname = path.join(pathname, 'index.html')
      } else if (fs.existsSync(projectPageHbs) || fs.existsSync(thaliaPageHbs)) {
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
        const siteName = requestHandler.website.name
        const title = path.basename(target) === 'index.hbs' ? `${siteName} – Home` : siteName
        requestHandler.website
          .asyncServeHandlebarsTemplate({
            res: requestHandler.res,
            templatePath: target,
            route: requestHandler.pathname,
            data: {
              requestInfo: requestHandler.requestInfo,
              version: requestHandler.website.version,
              title,
            },
          })
          .then(() => {
            finish(`Successfully rendered handlebars template ${requestHandler.pathname}`)
          })
          .catch((error) => {
            if (error instanceof TemplateError) {
              finish(`Handlebars template error ${requestHandler.pathname}`)
              return
            }
            console.error('Error rendering handlebars template:', requestHandler.pathname, error)
            if (!requestHandler.res.headersSent) {
              requestHandler.res.writeHead(500)
              requestHandler.res.end('Internal Server Error')
            }
            finish('Error rendering handlebars template')
          })
      } else {
        return next(requestHandler)
      }
    })
  }

  /** When no index is found and path is a directory under src/ or docs/, render folder listing (development only). */
  private static showFolderIndex(requestHandler: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      // console.debug("showFolderIndex: We are at this path: ", requestHandler.pathname)

      if (requestHandler.requestInfo.node_env !== 'development') return next(requestHandler)

      requestHandler.website.refreshPartialsForRender()
      const data = RequestHandler.resolveFolderIndexData(requestHandler)
      if (!data) return next(requestHandler)

      const partialTemplate = requestHandler.website.handlebars.partials['show_folder_index']
      if (!partialTemplate) return next(requestHandler)

      const contentHtml = compileHandlebarsTemplate(requestHandler.website.handlebars, partialTemplate)(data)
      const html = RequestHandler.renderFolderIndexWrapper(requestHandler, contentHtml, data.title)
      requestHandler.res.writeHead(200, { 'Content-Type': 'text/html' })
      requestHandler.res.end(html)
      finish(`Successfully rendered folder index ${requestHandler.pathname}`)
    })
  }

  private static isFolderIndexEntryVisible(name: string): boolean {
    return !name.startsWith('.')
  }

  private static compareFolderIndexEntries(a: FolderIndexEntry, b: FolderIndexEntry): number {
    return (
      Number(b.isDirectory) - Number(a.isDirectory) ||
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    )
  }

  private static resolveFolderIndexData(rh: RequestHandler): FolderIndexData | null {
    const rel = RequestHandler.decodePathnameForFilesystemLookup(rh.pathname)
    if (rel === null) return null

    const dirPath = RequestHandler.folderIndexFolders
      .map((folder) => path.join(rh.rootPath, folder, rel))
      .find((candidate) => {
        try {
          return fs.statSync(candidate).isDirectory()
        } catch {
          return false
        }
      })
    if (!dirPath) return null

    let entries: FolderIndexEntry[]
    try {
      entries = fs
        .readdirSync(dirPath, { withFileTypes: true })
        .filter((d) => RequestHandler.isFolderIndexEntryVisible(d.name))
        .map((d) => ({ name: d.name, isDirectory: d.isDirectory() }))
        .sort(RequestHandler.compareFolderIndexEntries)
    } catch {
      return null
    }

    const pathname = rh.pathname.replace(/\/$/, '') || ''
    const basePath = pathname ? `${pathname}/` : ''
    const segments = pathname.split('/').filter(Boolean)
    const parentPath = segments.length > 1 ? segments.slice(0, -1).join('/') : ''
    const title = path.basename(dirPath)
    return { pathname, basePath, entries, parentPath, title }
  }

  private static renderFolderIndexWrapper(rh: RequestHandler, contentHtml: string, title: string): string {
    rh.website.refreshPartialsForRender()
    rh.website.handlebars.registerPartial('content', contentHtml)
    const wrapper = rh.website.handlebars.partials['wrapper'] ?? ''
    return compileHandlebarsTemplate(rh.website.handlebars, wrapper)({
      requestInfo: rh.requestInfo,
      version: rh.website.version,
      title,
    })
  }

  /**
   * Serve a PDF from public, data, dist, or docs without requiring `.pdf` in the URL.
   * E.g. `/resume` → `public/resume.pdf`; `/guides/slides` → `public/guides/slides.pdf`.
   * Future: Marp may compile matching `src/*.md` with `marp: true` front matter (not implemented).
   */
  private static tryPdf(requestHandler: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      const target = RequestHandler.resolvePdfPath(requestHandler)
      if (!target) return next(requestHandler)

      const contentType = 'application/pdf'
      setStaticFileHeaders(
        requestHandler.res,
        requestHandler.pathname,
        contentType,
        path.basename(target),
      )

      streamStaticFile(
        requestHandler.req,
        requestHandler.res,
        target,
        finish,
        `pdf ${requestHandler.pathname}`,
      )
    })
  }

  /**
   * Resolve URL path to a PDF under public/data/dist/docs (same extensionless rules as markdown/hbs).
   */
  private static resolvePdfPath(rh: RequestHandler): string | null {
    const p = RequestHandler.decodePathnameForFilesystemLookup(rh.pathname)
    if (p === null) return null

    const candidates: string[] = []
    if (p.endsWith('.pdf')) {
      candidates.push(p)
    } else {
      candidates.push(`${p}.pdf`)
      candidates.push(path.join(p, 'index.pdf'))
    }
    if (p === 'index.html') {
      candidates.push('index.pdf')
    }

    for (const folder of RequestHandler.pdfStaticFolders) {
      for (const rel of candidates) {
        const filePath = path.join(rh.rootPath, folder, rel)
        try {
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return filePath
        } catch {
          continue
        }
      }
    }
    return null
  }

  /**
   * Similar to tryMarkdown
   * Serve src/path.csv or src/path.tsv via csv_show.hbs
   * Passing in raw=true will serve the raw csv/tsv file.
   */
  private static tryCsv(requestHandler: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      if (!requestHandler.pathname.endsWith('.csv') && !requestHandler.pathname.endsWith('.tsv')) {
        return next(requestHandler)
      }
      
      const target = requestHandler.projectSourcePath
      if (!target) return next(requestHandler)
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return next(requestHandler)

      fs.promises.readFile(target, 'utf8').then((content) => {
        if(requestHandler.requestInfo.query.raw === 'true') {
          requestHandler.res.writeHead(200, { 'Content-Type': getContentType(target) })
          requestHandler.res.end(content)
          return finish(`Successfully served raw csv ${requestHandler.pathname}`)
        }

        const html = requestHandler.website.getContentHtml('gets-overwritten-doesnt-matter', 'csv_show')
        const data = {
          requestInfo: requestHandler.requestInfo,
          version: requestHandler.website.version,
          pathname: requestHandler.pathname,
          filename: path.basename(target),
          title: path.basename(target),
        }
        requestHandler.res.writeHead(200, { 'Content-Type': 'text/html' })
        requestHandler.res.end(html(data))
        finish(`Successfully rendered csv ${requestHandler.pathname}`)
      }).catch((err) => {
        console.error(`Error serving csv ${requestHandler.pathname}:`, err)
        requestHandler.res.writeHead(500)
        requestHandler.res.end('Internal Server Error')
        finish('Error serving csv file')
      })
    })
  }

  /** Serve src/path.md or src/path/index.md via wrapper (same path rules as tryHandlebars). */
  private static tryMarkdown(requestHandler: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      const target = RequestHandler.resolveMarkdownPath(requestHandler)
      if (!target) return next(requestHandler)

      fs.promises
        .readFile(target, 'utf8')
        .then((content) => {
          if(requestHandler.requestInfo.query.raw === 'true') {
            requestHandler.res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
            requestHandler.res.end(content)
            return finish(`Successfully served raw markdown ${requestHandler.pathname}`)
          }

          const html = renderMarkdownPage(
            requestHandler.website.handlebars,
            content,
            {
              requestInfo: requestHandler.requestInfo,
              version: requestHandler.website.version,
            },
            {
              reloadPartials: () => requestHandler.website.refreshPartialsForRender(),
              documentTitle: RequestHandler.isProjectDocsPath(requestHandler.rootPath, target)
                ? {
                    websiteName: requestHandler.website.name,
                    sourcePath: target,
                  }
                : undefined,
            },
          )
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

  /** True when `target` is a file under the site's `docs/` folder (not `src/`). */
  private static isProjectDocsPath(rootPath: string, target: string): boolean {
    const docsRoot = path.resolve(rootPath, 'docs')
    const resolved = path.resolve(target)
    return resolved === docsRoot || resolved.startsWith(docsRoot + path.sep)
  }

  // TODO: /index.html should try /index.md
  private static resolveMarkdownPath(rh: RequestHandler): string | null {
    const p = RequestHandler.decodePathnameForFilesystemLookup(rh.pathname)
    if (p === null) return null
    const mdCandidates = [path.join(p, 'index.md'), p.endsWith('.md') ? p : p + '.md']
    if (p === 'index.html') {
      mdCandidates.push('index.md')
    }

    for (const mdPath of mdCandidates) {
      const project = path.join(rh.rootPath, 'src', mdPath)
      const thalia = path.join(rh.thaliaRoot, 'src', mdPath)
      if (fs.existsSync(project) && fs.statSync(project).isFile()) return project
      if (fs.existsSync(thalia) && fs.statSync(thalia).isFile()) return thalia

      // If development, serve from /docs as well
      if (rh.website.env === 'development') {
        const docs = path.join(rh.rootPath, 'docs', mdPath)
        if (fs.existsSync(docs) && fs.statSync(docs).isFile()) return docs
      }
    }
    return null
  }

  /**
   * Compile browser TypeScript on request, preferring the site's `src/js` over
   * framework `src/js` at the same URL. Bun writes the bundle to the site's
   * ignored `dist/` cache; static `public/js` remains the final fallback.
   */
  private static tryTypescript(requestHandler: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      if (!requestHandler.pathname.endsWith('.js')) {
        return next(requestHandler)
      }

      const projectTsPath = requestHandler.projectSourcePath.replace('.js', '.ts')
      const frameworkTsPath = requestHandler.thaliaSourcePath.replace('.js', '.ts')
      const tsPath = fs.existsSync(projectTsPath)
        ? projectTsPath
        : fs.existsSync(frameworkTsPath)
          ? frameworkTsPath
          : null

      if (tsPath) {
        // create dist folder if it doesn't exist
        fs.mkdirSync(requestHandler.projectDistPath, { recursive: true })
        Bun.build({
          entrypoints: [tsPath],
          target: 'browser',
          outdir: requestHandler.projectDistPath,
        })
          .then((result) => {
            if (!result.success || !result.outputs[0]) {
              throw new Error(`Bun.build produced no JavaScript for ${requestHandler.pathname}`)
            }
            const jsPath = result.outputs[0].path
            return Bun.file(jsPath).text()
          })
          .then((jsText) => {
            requestHandler.res.writeHead(200, { 'Content-Type': 'text/javascript' })
            requestHandler.res.end(jsText)
            return finish(`Successfully compiled typescript file ${requestHandler.pathname}`)
          })
          .catch((error) => {
            // Fall back to static handling so a site-owned public/js file can
            // still serve browser code which Bun.build cannot bundle.
            console.error('TypeScript compile failed, falling back:', requestHandler.pathname, error)
            return next(requestHandler)
          })
      } else {
        return next(requestHandler)
      }
    })
  }

  /**
   * Compile src/css/*.scss on demand for *.css requests; write to dist/ on success.
   * On compile failure: 500 with raw SCSS body (dev-friendly; prod usually hits dist first).
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
        try {
          const css = sass.compile(target, THALIA_SASS_OPTIONS).css.toString()
          const cssPath = path.join(requestHandler.rootPath, 'dist', requestHandler.pathname)
          fs.mkdirSync(path.dirname(cssPath), { recursive: true })
          fs.writeFileSync(cssPath, css)
          console.debug('Successfully compiled scss file', requestHandler.pathname)
          requestHandler.res.writeHead(200, { 'Content-Type': 'text/css' })
          requestHandler.res.end(css)
          return finish(`Successfully compiled scss file ${requestHandler.pathname}`)
        } catch (error) {
          console.error('SCSS compile failed, serving raw source:', requestHandler.pathname, error)
          requestHandler.res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
          requestHandler.res.end(fs.readFileSync(target, 'utf8'))
          return finish('Error compiling scss file, served raw scss with 500')
        }
      } else {
        return next(requestHandler)
      }
    })
  }

  /**
   * Walk pathname segments through the controller tree.
   * - Hitting a function mid-walk returns that leaf (remaining segments are not nested keys).
   * - Ending on a nested object uses `index` when it is a function (so `/logs` → `logs.index`).
   * - Missing segment → null (caller continues the static / 404 chain).
   */
  static resolveControllerLeaf(
    controllers: Record<string, NestedControllerMap>,
    pathname: string,
    homepageController = 'homepage',
  ): Controller | null {
    let segments = pathname.split('/').filter(Boolean)
    if (segments.length === 0) {
      segments = [homepageController]
    }

    let node: NestedControllerMap = controllers
    for (const segment of segments) {
      if (typeof node === 'function') {
        return node
      }
      if (node === null || typeof node !== 'object' || !(segment in node)) {
        return null
      }
      node = (node as Record<string, NestedControllerMap>)[segment]
    }

    if (typeof node === 'function') {
      return node
    }
    if (node !== null && typeof node === 'object') {
      const index = (node as Record<string, NestedControllerMap>)['index']
      if (typeof index === 'function') {
        return index
      }
    }
    return null
  }

  private static tryController(requestHandler: RequestHandler): Promise<RequestHandler> {
    return new Promise((next, finish) => {
      const leaf = RequestHandler.resolveControllerLeaf(
        requestHandler.website.controllers,
        requestHandler.pathname ?? '',
        requestHandler.requestInfo.controller,
      )
      if (!leaf) {
        return next(requestHandler)
      }
      leaf(requestHandler.res, requestHandler.req, requestHandler.website, requestHandler.requestInfo)
      return finish(`Successfully executed controller ${requestHandler.requestInfo.controller}`)
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
