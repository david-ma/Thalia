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
import type { IncomingMessage, ServerResponse } from 'http'
import { latestData } from '../../server/controllers.js'
import type { Website } from '../../server/website.js'
import type { RequestInfo } from '../../server/server.js'

type Captured = {
  statusCode: number
  headers: Record<string, string>
  body: string
}

function makeResponse(): { res: ServerResponse; done: Promise<void>; captured: Captured } {
  const captured: Captured = { statusCode: 0, headers: {}, body: '' }
  let resolve!: () => void
  const done = new Promise<void>((r) => {
    resolve = r
  })
  const res = {
    writeHead(code: number, headers?: Record<string, string>) {
      captured.statusCode = code
      if (headers) captured.headers = { ...captured.headers, ...headers }
      return this
    },
    end(body?: string) {
      if (typeof body === 'string') captured.body = body
      resolve()
    },
  } as unknown as ServerResponse
  return { res, done, captured }
}

function makeRequestInfo(): RequestInfo {
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
  }
}

describe('latestData', () => {
  let rootPath: string
  let dataDir: string
  let website: Website
  const req = {} as IncomingMessage
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
})
