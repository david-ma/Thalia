/**
 * Unit tests for request-handler.ts
 *
 * Tests handler behaviour with mock request/response and minimal website.
 * Run from Thalia root: bun test tests/Unit/request-handler.test.ts
 */

import { describe, test, expect } from 'bun:test'
import { RequestHandler } from '../../server/request-handler.js'
import type { RequestInfo } from '../../server/server.js'
import type { IncomingMessage, ServerResponse } from 'http'
import path from 'path'

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
