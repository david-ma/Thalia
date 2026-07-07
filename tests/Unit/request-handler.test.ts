/**
 * Unit tests for request-handler.ts
 *
 * Tests handler behaviour with mock request/response and minimal website.
 * Run from Thalia root: bun test tests/Unit/request-handler.test.ts
 */

import { describe, test, expect, afterEach } from 'bun:test'
import { RequestHandler } from '../../server/request-handler.js'
import type { RequestInfo } from '../../server/server.js'
import type { IncomingMessage, ServerResponse } from 'http'
import path from 'path'
import fs from 'fs'
import os from 'os'

/** Narrow shape for testing private statics; do not intersect with typeof RequestHandler (clash → never). */
type RequestHandlerPrivateStub = {
  decodePathnameForFilesystemLookup(pathname: string): string | null
  filesystemRelativePath(pathname: string): string | null
  resolvePdfPath(rh: { rootPath: string; pathname: string }): string | null
  getContentType(filePath: string): string
  mimeBaseType(contentType: string): string
  isGzipFriendlyMime(contentType: string): boolean
  setStaticFileHeaders(
    res: ServerResponse,
    pathname: string,
    contentType: string,
    servedFilename?: string,
  ): void
  resolveFolderIndexData(rh: { rootPath: string; pathname: string }): {
    pathname: string
    basePath: string
    entries: { name: string; isDirectory: boolean }[]
    parentPath: string
    title: string
  } | null
}

const rhPrivate = RequestHandler as unknown as RequestHandlerPrivateStub
const decodePathnameForFilesystemLookup = rhPrivate.decodePathnameForFilesystemLookup.bind(RequestHandler)
const filesystemRelativePath = rhPrivate.filesystemRelativePath.bind(RequestHandler)
const resolvePdfPath = rhPrivate.resolvePdfPath.bind(RequestHandler)
const getContentType = rhPrivate.getContentType.bind(RequestHandler)
const mimeBaseType = rhPrivate.mimeBaseType.bind(RequestHandler)
const isGzipFriendlyMime = rhPrivate.isGzipFriendlyMime.bind(RequestHandler)
const setStaticFileHeaders = rhPrivate.setStaticFileHeaders.bind(RequestHandler)
const resolveFolderIndexData = rhPrivate.resolveFolderIndexData.bind(RequestHandler)

function mockResponse(): ServerResponse & { headers: Record<string, string | number> } {
  const headers: Record<string, string | number> = {}
  return {
    headers,
    setHeader(name: string, value: string | number) {
      headers[name.toLowerCase()] = value
    },
    writeHead: () => mockResponse(),
    end: () => mockResponse(),
  } as unknown as ServerResponse & { headers: Record<string, string | number> }
}

describe('RequestHandler decodePathnameForFilesystemLookup', () => {
  test('decodes %20 and other escapes per segment', () => {
    expect(decodePathnameForFilesystemLookup('/notes/My%20Vault/Page')).toBe('notes/My Vault/Page')
    expect(decodePathnameForFilesystemLookup('/a%2Bb')).toBe('a+b')
  })

  test('empty or root becomes empty relative path', () => {
    expect(decodePathnameForFilesystemLookup('')).toBe('')
    expect(decodePathnameForFilesystemLookup('/')).toBe('')
  })

  test('rejects .. after decode (e.g. %2e%2e)', () => {
    expect(decodePathnameForFilesystemLookup('/safe/%2e%2e/etc')).toBeNull()
    expect(decodePathnameForFilesystemLookup('/a/b/..')).toBeNull()
  })

  test('invalid percent-encoding returns null', () => {
    expect(decodePathnameForFilesystemLookup('/foo%')).toBeNull()
  })

  test('filesystemRelativePath matches decodePathnameForFilesystemLookup', () => {
    expect(filesystemRelativePath('/a%20b')).toBe('a b')
    expect(filesystemRelativePath('/bad%')).toBeNull()
  })
})

describe('RequestHandler getContentType', () => {
  test('text-like extensions include charset=utf-8', () => {
    expect(getContentType('/index.html')).toBe('text/html; charset=utf-8')
    expect(getContentType('/css/main.css')).toBe('text/css; charset=utf-8')
    expect(getContentType('/app.js')).toBe('text/javascript; charset=utf-8')
    expect(getContentType('/data.json')).toBe('application/json; charset=utf-8')
    expect(getContentType('/readme.md')).toBe('text/markdown; charset=utf-8')
    expect(getContentType('/export.csv')).toBe('text/csv; charset=utf-8')
    expect(getContentType('/robots.txt')).toBe('text/plain; charset=utf-8')
  })

  test('binary extensions omit charset', () => {
    expect(getContentType('/photo.png')).toBe('image/png')
    expect(getContentType('/doc.pdf')).toBe('application/pdf')
    expect(getContentType('/font.woff2')).toBe('font/woff2')
  })

  test('unknown extension is application/octet-stream', () => {
    expect(getContentType('/file.unknown')).toBe('application/octet-stream')
  })
})

describe('RequestHandler mimeBaseType', () => {
  test('strips parameters and lowercases', () => {
    expect(mimeBaseType('text/html; charset=utf-8')).toBe('text/html')
    expect(mimeBaseType('Text/CSS; Charset=UTF-8')).toBe('text/css')
    expect(mimeBaseType('application/pdf')).toBe('application/pdf')
  })
})

describe('RequestHandler isGzipFriendlyMime', () => {
  test('allows text/* and common textual application types', () => {
    expect(isGzipFriendlyMime('text/html; charset=utf-8')).toBe(true)
    expect(isGzipFriendlyMime('text/markdown; charset=utf-8')).toBe(true)
    expect(isGzipFriendlyMime('text/plain')).toBe(true)
    expect(isGzipFriendlyMime('application/json; charset=utf-8')).toBe(true)
    expect(isGzipFriendlyMime('image/svg+xml; charset=utf-8')).toBe(true)
  })

  test('rejects typical binary types', () => {
    expect(isGzipFriendlyMime('image/png')).toBe(false)
    expect(isGzipFriendlyMime('image/jpeg')).toBe(false)
    expect(isGzipFriendlyMime('font/woff2')).toBe(false)
    expect(isGzipFriendlyMime('application/pdf')).toBe(false)
    expect(isGzipFriendlyMime('application/octet-stream')).toBe(false)
  })
})

describe('RequestHandler setStaticFileHeaders', () => {
  test('sets Content-Type as given', () => {
    const res = mockResponse()
    setStaticFileHeaders(res, '/readme.md', 'text/markdown; charset=utf-8')
    expect(res.headers['content-type']).toBe('text/markdown; charset=utf-8')
  })

  test('Content-Disposition inline uses mime base type (charset must not break match)', () => {
    const res = mockResponse()
    setStaticFileHeaders(res, '/notes/guide.md', 'text/markdown; charset=utf-8', 'guide.md')
    expect(res.headers['content-disposition']).toBe('inline; filename="guide.md"')
  })

  test('inline for pdf and plain text without charset', () => {
    const res = mockResponse()
    setStaticFileHeaders(res, '/doc.pdf', 'application/pdf')
    expect(res.headers['content-disposition']).toBe('inline; filename="doc.pdf"')

    const res2 = mockResponse()
    setStaticFileHeaders(res2, '/log.txt', 'text/plain; charset=utf-8')
    expect(res2.headers['content-disposition']).toBe('inline; filename="log.txt"')
  })

  test('inline for css and javascript', () => {
    const res = mockResponse()
    setStaticFileHeaders(res, '/css/main.css', 'text/css; charset=utf-8')
    expect(res.headers['content-disposition']).toBe('inline; filename="main.css"')

    const res2 = mockResponse()
    setStaticFileHeaders(res2, '/app.js', 'text/javascript; charset=utf-8')
    expect(res2.headers['content-disposition']).toBe('inline; filename="app.js"')
  })

  test('no Content-Disposition for binary assets', () => {
    const res = mockResponse()
    setStaticFileHeaders(res, '/images/photo.png', 'image/png')
    expect(res.headers['content-disposition']).toBeUndefined()

    const res2 = mockResponse()
    setStaticFileHeaders(res2, '/fonts/icon.woff2', 'font/woff2')
    expect(res2.headers['content-disposition']).toBeUndefined()
  })
})

describe('RequestHandler resolvePdfPath', () => {
  const rootPath = path.join(import.meta.dir, '..', '..', 'websites', 'example-src')

  test('finds public/sample-doc.pdf for extensionless URL', () => {
    const target = resolvePdfPath({ rootPath, pathname: '/sample-doc' })
    expect(target).toBe(path.join(rootPath, 'public', 'sample-doc.pdf'))
  })
})

describe('RequestHandler resolveFolderIndexData', () => {
  let tmpRoot = ''

  afterEach(() => {
    if (tmpRoot) {
      fs.rmSync(tmpRoot, { recursive: true, force: true })
      tmpRoot = ''
    }
  })

  test('returns null for invalid percent-encoding', () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-folder-index-'))
    expect(resolveFolderIndexData({ rootPath: tmpRoot, pathname: '/bad%' })).toBeNull()
  })

  test('prefers docs/ over src/ when both directories exist', () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-folder-index-'))
    const rel = 'topic'
    fs.mkdirSync(path.join(tmpRoot, 'docs', rel), { recursive: true })
    fs.mkdirSync(path.join(tmpRoot, 'src', rel), { recursive: true })
    fs.writeFileSync(path.join(tmpRoot, 'docs', rel, 'from-docs.txt'), '')
    fs.writeFileSync(path.join(tmpRoot, 'src', rel, 'from-src.txt'), '')

    const data = resolveFolderIndexData({ rootPath: tmpRoot, pathname: `/${rel}` })
    expect(data?.entries.map((e) => e.name)).toEqual(['from-docs.txt'])
  })

  test('lists visible entries with directories first', () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-folder-index-'))
    const guidesDir = path.join(tmpRoot, 'docs', 'guides')
    fs.mkdirSync(path.join(guidesDir, 'chapter'), { recursive: true })
    fs.writeFileSync(path.join(guidesDir, 'readme.md'), '# hi')
    fs.writeFileSync(path.join(guidesDir, '.hidden'), 'secret')

    const data = resolveFolderIndexData({ rootPath: tmpRoot, pathname: '/guides' })
    expect(data).toEqual({
      pathname: '/guides',
      basePath: '/guides/',
      entries: [
        { name: 'chapter', isDirectory: true },
        { name: 'readme.md', isDirectory: false },
      ],
      parentPath: '',
      title: 'guides',
    })
  })

  test('computes parent path and title for nested directories', () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-folder-index-'))
    fs.mkdirSync(path.join(tmpRoot, 'src', 'guides', 'chapter'), { recursive: true })

    const data = resolveFolderIndexData({ rootPath: tmpRoot, pathname: '/guides/chapter/' })
    expect(data?.pathname).toBe('/guides/chapter')
    expect(data?.basePath).toBe('/guides/chapter/')
    expect(data?.parentPath).toBe('guides')
    expect(data?.title).toBe('chapter')
  })
})

describe('RequestHandler checkPathExploit', () => {
  test('pathname containing .. returns 400 Bad Request', (done) => {
    const rootPath = path.join(import.meta.dir, '../..', 'websites', 'example-minimal')
    const mockWebsite = {
      rootPath,
      routeGuard: {
        handleRequestChain: (rh: RequestHandler) => Promise.resolve(rh),
      },
      controllers: {} as Record<string, unknown>,
      env: 'test',
    } as any

    const requestInfo: RequestInfo = {
      host: 'localhost',
      domain: 'localhost',
      url: '/../etc/passwd',
      ip: '127.0.0.1',
      method: 'GET',
      pathname: '/../etc/passwd',
      controller: '..',
      action: '',
      slug: 'passwd',
      cookies: {},
      node_env: 'test',
      query: {},
    }

    const req = { headers: {} } as IncomingMessage
    const res = {
      writeHead: null as unknown as ServerResponse['writeHead'],
      end: null as unknown as ServerResponse['end'],
      setHeader: () => {},
    } as unknown as ServerResponse

    let writeHeadCalledWith: [number, string] | null = null
    res.writeHead = ((statusCode: number, statusMessage?: string) => {
      writeHeadCalledWith = [statusCode, statusMessage ?? '']
      return res
    }) as ServerResponse['writeHead']

    res.end = ((body?: unknown) => {
      expect(writeHeadCalledWith).not.toBeNull()
      expect(writeHeadCalledWith![0]).toBe(400)
      done()
    }) as ServerResponse['end']

    const handler = new RequestHandler(mockWebsite)
    handler.handleRequest(req, res, requestInfo)
  })

  test('pathname without .. passes through (calls end with 404)', (done) => {
    const rootPath = path.join(import.meta.dir, '../..', 'websites', 'example-minimal')
    const mockWebsite = {
      rootPath,
      routeGuard: {
        handleRequestChain: (rh: RequestHandler) => Promise.resolve(rh),
      },
      controllers: {} as Record<string, unknown>,
      env: 'test',
    } as any

    const requestInfo: RequestInfo = {
      host: 'localhost',
      domain: 'localhost',
      url: '/safe/path',
      ip: '127.0.0.1',
      method: 'GET',
      pathname: '/safe/path',
      controller: 'safe',
      action: 'path',
      slug: 'path',
      cookies: {},
      node_env: 'test',
      query: {},
    }

    const req = { headers: {} } as IncomingMessage
    const res = {
      writeHead: null as unknown as ServerResponse['writeHead'],
      end: null as unknown as ServerResponse['end'],
      setHeader: () => {},
    } as unknown as ServerResponse

    res.writeHead = (() => res) as ServerResponse['writeHead']
    res.end = ((body?: unknown) => {
      expect(String(body)).toBe('404 Not Found')
      done()
    }) as ServerResponse['end']

    const handler = new RequestHandler(mockWebsite)
    handler.handleRequest(req, res, requestInfo)
  })
})
