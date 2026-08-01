/**
 * Unit tests for `latestData` controller in server/controllers.ts.
 *
 * No HTTP server: a tmpdir acts as the website rootPath, the response is a
 * minimal mock that captures `writeHead` / `end`, and we await a deferred
 * promise that resolves on `end`.
 *
 * Run from Thalia root: bun test tests/Unit/latest-data.test.ts
 */

import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { EventEmitter } from 'events'
import type { IncomingMessage, ServerResponse } from 'http'
import { followDataFile, latestData } from '../../server/controllers.js'
import type { Website } from '../../server/website.js'
import type { RequestInfo } from '../../server/server.js'

type Captured = {
  statusCode: number
  headers: Record<string, string>
  body: string
  chunks: string[]
}

function makeResponse(): { res: ServerResponse; done: Promise<void>; captured: Captured } {
  const captured: Captured = { statusCode: 0, headers: {}, body: '', chunks: [] }
  let resolve!: () => void
  const done = new Promise<void>((r) => {
    resolve = r
  })
  const res = Object.assign(new EventEmitter(), {
    writableEnded: false,
    writeHead(code: number, headers?: Record<string, string>) {
      captured.statusCode = code
      if (headers) captured.headers = { ...captured.headers, ...headers }
      return this
    },
    setHeader(name: string, value: string | number) {
      captured.headers[name] = String(value)
      return this
    },
    write(chunk: string | Buffer) {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      captured.chunks.push(text)
      captured.body += text
      return true
    },
    end(body?: string) {
      if (typeof body === 'string') {
        captured.body += body
        captured.chunks.push(body)
      }
      this.writableEnded = true
      resolve()
    },
  }) as unknown as ServerResponse
  return { res, done, captured }
}

function makeRequest(): IncomingMessage {
  return new EventEmitter() as unknown as IncomingMessage
}

function makeRequestInfo(overrides: Partial<RequestInfo> = {}): RequestInfo {
  return {
    host: 'localhost',
    domain: 'localhost',
    url: '/data/logs',
    ip: '127.0.0.1',
    method: 'GET',
    pathname: '/data/logs',
    controller: 'data',
    action: 'logs',
    slug: '',
    cookies: {},
    node_env: 'test',
    query: {},
    ...overrides,
  }
}

describe('latestData', () => {
  let rootPath: string
  let dataDir: string
  let website: Website
  const req = makeRequest()
  const requestInfo = makeRequestInfo()

  beforeEach(() => {
    rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-latest-data-'))
    dataDir = path.join(rootPath, 'data', 'logs')
    fs.mkdirSync(dataDir, { recursive: true })
    website = { name: 'test', rootPath } as unknown as Website
  })

  afterEach(() => {
    fs.rmSync(rootPath, { recursive: true, force: true })
  })

  test('redirects 302 to lexicographically latest .json file (defaults)', async () => {
    fs.writeFileSync(path.join(dataDir, '20260101_a.json'), '{}')
    fs.writeFileSync(path.join(dataDir, '20260201_b.json'), '{}')
    fs.writeFileSync(path.join(dataDir, '20251201_c.json'), '{}')

    const { res, done, captured } = makeResponse()
    latestData('logs')(res, req, website, requestInfo)
    await done

    expect(captured.statusCode).toBe(302)
    expect(captured.headers.Location).toBe('/logs/20260201_b.json')
  })

  test('strips .gz so Location points at uncompressed sibling', async () => {
    fs.writeFileSync(path.join(dataDir, '20260101_a.tsv.gz'), 'x')
    fs.writeFileSync(path.join(dataDir, '20260301_b.tsv.gz'), 'x')

    const { res, done, captured } = makeResponse()
    latestData('logs', { type: 'tsv' })(res, req, website, requestInfo)
    await done

    expect(captured.statusCode).toBe(302)
    expect(captured.headers.Location).toBe('/logs/20260301_b.tsv')
  })

  test('filters by extension and ignores non-matching files', async () => {
    fs.writeFileSync(path.join(dataDir, 'older.txt'), 'x')
    fs.writeFileSync(path.join(dataDir, 'only-one.json'), '{}')
    fs.writeFileSync(path.join(dataDir, 'newer.txt'), 'x')

    const { res, done, captured } = makeResponse()
    latestData('logs', { type: 'json' })(res, req, website, requestInfo)
    await done

    expect(captured.statusCode).toBe(302)
    expect(captured.headers.Location).toBe('/logs/only-one.json')
  })

  test('skips subdirectories even if their name ends with the requested type', async () => {
    // A directory named like a json file should NOT be picked.
    fs.mkdirSync(path.join(dataDir, 'subdir.json'))
    fs.writeFileSync(path.join(dataDir, 'real.json'), '{}')

    const { res, done, captured } = makeResponse()
    latestData('logs', { type: 'json' })(res, req, website, requestInfo)
    await done

    expect(captured.statusCode).toBe(302)
    expect(captured.headers.Location).toBe('/logs/real.json')
  })

  test('returns 404 and logs ENOENT when the data folder does not exist', async () => {
    const errSpy = spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { res, done, captured } = makeResponse()
      latestData('does-not-exist')(res, req, website, requestInfo)
      await done

      expect(captured.statusCode).toBe(404)
      expect(errSpy).toHaveBeenCalledTimes(1)
      expect(errSpy.mock.calls[0]?.[0]).toMatch(/ENOENT/)
    } finally {
      errSpy.mockRestore()
    }
  })

  test('returns 404 and logs when no file matches the requested type', async () => {
    fs.writeFileSync(path.join(dataDir, 'only.txt'), 'x')

    const errSpy = spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { res, done, captured } = makeResponse()
      latestData('logs', { type: 'json' })(res, req, website, requestInfo)
      await done

      expect(captured.statusCode).toBe(404)
      expect(errSpy).toHaveBeenCalledTimes(1)
      expect(errSpy.mock.calls[0]?.[0]).toBe('No .json files in data/logs')
    } finally {
      errSpy.mockRestore()
    }
  })

  test('sort=lastModified picks the file with the most recent mtime', async () => {
    const oldPath = path.join(dataDir, 'a-old.json')
    const newPath = path.join(dataDir, 'b-new.json')
    fs.writeFileSync(oldPath, '{}')
    fs.writeFileSync(newPath, '{}')
    // Push a-old.json's mtime into the past so name-sort and mtime-sort disagree.
    const past = new Date(Date.now() - 60_000)
    fs.utimesSync(oldPath, past, past)

    const { res, done, captured } = makeResponse()
    latestData('logs', { type: 'json', sort: 'lastModified' })(res, req, website, requestInfo)
    await done

    expect(captured.statusCode).toBe(302)
    expect(captured.headers.Location).toBe('/logs/b-new.json')
  })

  test('sort=lastModified ignores files of other types (regression)', async () => {
    // .txt is freshly modified; .json is older. Asking for .json must still
    // return the .json, not the .txt.
    const txtPath = path.join(dataDir, 'distractor.txt')
    const jsonPath = path.join(dataDir, 'wanted.json')
    fs.writeFileSync(jsonPath, '{}')
    const past = new Date(Date.now() - 60_000)
    fs.utimesSync(jsonPath, past, past)
    fs.writeFileSync(txtPath, 'x') // newer mtime

    const { res, done, captured } = makeResponse()
    latestData('logs', { type: 'json', sort: 'lastModified' })(res, req, website, requestInfo)
    await done

    expect(captured.statusCode).toBe(302)
    expect(captured.headers.Location).toBe('/logs/wanted.json')
  })

  test('slug=stream live-follows the latest uncompressed file', async () => {
    const filePath = path.join(dataDir, 'app.log')
    fs.writeFileSync(filePath, 'line1\n')

    const streamReq = makeRequest()
    const { res, captured } = makeResponse()
    latestData('logs', { type: 'log' })(
      res,
      streamReq,
      website,
      makeRequestInfo({ slug: 'stream', pathname: '/data/logs/stream', url: '/data/logs/stream' }),
    )

    // wait for async readdir + initial tail
    await Bun.sleep(50)
    expect(captured.statusCode).toBe(200)
    expect(captured.headers['Content-Type']).toBe('text/plain; charset=utf-8')
    expect(captured.headers['X-Filename']).toBe('app.log')
    expect(captured.body).toBe('line1\n')

    fs.appendFileSync(filePath, 'line2\n')
    await Bun.sleep(600)
    expect(captured.body).toBe('line1\nline2\n')

    streamReq.emit('close')
  })

  test('slug=stream 404s when only a .gz sidecar exists', async () => {
    fs.writeFileSync(path.join(dataDir, 'only.log.gz'), 'x')
    const errSpy = spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { res, done, captured } = makeResponse()
      latestData('logs', { type: 'log' })(
        res,
        req,
        website,
        makeRequestInfo({ slug: 'stream', pathname: '/data/logs/stream' }),
      )
      await done

      expect(captured.statusCode).toBe(404)
      expect(errSpy.mock.calls[0]?.[0]).toMatch(/stream skips \.gz/)
    } finally {
      errSpy.mockRestore()
    }
  })
})

describe('followDataFile', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-follow-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('sends only the trailing initialBytes then new appends', async () => {
    const filePath = path.join(tmpDir, 'big.log')
    fs.writeFileSync(filePath, 'AAAAAAAAAA' + 'BBBBBBBBBB')

    const streamReq = makeRequest()
    const { res, captured } = makeResponse()
    followDataFile(res, streamReq, filePath, { initialBytes: 10, pollMs: 50 })

    expect(captured.body).toBe('BBBBBBBBBB')

    fs.appendFileSync(filePath, 'CCC')
    await Bun.sleep(80)
    expect(captured.body).toBe('BBBBBBBBBBCCC')

    streamReq.emit('close')
  })
})
