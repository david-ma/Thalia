import { describe, expect, test, afterAll } from 'bun:test'
import type { IncomingMessage, ServerResponse } from 'http'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { hbs, md_file, wrap } from '../../server/controllers.js'
import type { Website } from '../../server/website.js'
import type { RequestInfo } from '../../server/server.js'

function makeRes() {
  let body = ''
  let status = 200
  const res = {
    writeHead(code: number) {
      status = code
    },
    end(chunk?: string) {
      if (chunk) body = chunk
    },
    get body() {
      return body
    },
    get statusCode() {
      return status
    },
  }
  return res as unknown as ServerResponse & { body: string; statusCode: number }
}

describe('hbs / wrap template context', () => {
  test('hbs injects requestInfo and version; static data overrides', () => {
    let received: Record<string, unknown> | null = null
    const website = {
      version: { gitHash: 'abc1234', version: '1.2.3' },
      getContentHtml() {
        return (locals: Record<string, unknown>) => {
          received = locals
          return '<html>ok</html>'
        }
      },
      renderError() {},
    } as unknown as Website

    const requestInfo = {
      pathname: '/admin/overview',
      userAuth: { role: 'admin', userId: 1, name: 'Ada' },
    } as unknown as RequestInfo

    const controller = hbs('admin_overview', { title: 'Overview', version: { gitHash: 'override' } })
    const res = makeRes()
    controller(res, {} as IncomingMessage, website, requestInfo)

    expect(res.statusCode).toBe(200)
    expect(received).not.toBeNull()
    expect(received!.content).toBe('admin_overview')
    expect(received!.wrapper).toBe('wrapper')
    expect(received!.requestInfo).toBe(requestInfo)
    expect(received!.title).toBe('Overview')
    expect(received!.version).toEqual({ gitHash: 'override' })
  })

  test('hbs uses website.version when data omits version', () => {
    let received: Record<string, unknown> | null = null
    const version = { gitHash: 'deadbeef', version: '9.9.9' }
    const website = {
      version,
      getContentHtml() {
        return (locals: Record<string, unknown>) => {
          received = locals
          return 'ok'
        }
      },
      renderError() {},
    } as unknown as Website

    const requestInfo = { pathname: '/x' } as unknown as RequestInfo
    hbs('page')(makeRes(), {} as IncomingMessage, website, requestInfo)
    expect(received!.version).toBe(version)
    expect(received!.requestInfo).toBe(requestInfo)
  })

  test('wrap routes .hbs to hbs with injected context', () => {
    let received: Record<string, unknown> | null = null
    const website = {
      version: { gitHash: 'wrap-hash' },
      getContentHtml() {
        return (locals: Record<string, unknown>) => {
          received = locals
          return 'wrapped'
        }
      },
      renderError() {},
    } as unknown as Website
    const requestInfo = { pathname: '/admin/overview' } as unknown as RequestInfo
    wrap('admin_overview.hbs')(makeRes(), {} as IncomingMessage, website, requestInfo)
    expect(received!.version).toEqual({ gitHash: 'wrap-hash' })
    expect(received!.requestInfo).toBe(requestInfo)
  })
})

describe('md_file template context', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-md-wrap-'))
  const srcDir = path.join(tmpRoot, 'src')

  afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  })

  test('md_file injects requestInfo and version; static data overrides', async () => {
    fs.mkdirSync(srcDir, { recursive: true })
    fs.writeFileSync(path.join(srcDir, 'note.md'), '# Hello\n')

    let received: Record<string, unknown> | null = null
    const website = {
      rootPath: tmpRoot,
      version: { gitHash: 'mdhash' },
      handlebars: {
        registerPartial() {},
        partials: { wrapper: 'wrapper-body' },
        compile() {
          return (locals: Record<string, unknown>) => {
            received = locals
            return '<html>md</html>'
          }
        },
      },
      renderError() {},
    } as unknown as Website

    const requestInfo = { pathname: '/docs/note' } as unknown as RequestInfo
    const controller = md_file('note.md', { title: 'Note', requestInfo: { pathname: 'shadowed' } })
    const res = makeRes()
    controller(res, {} as IncomingMessage, website, requestInfo)

    for (let i = 0; i < 20 && received == null; i++) {
      await new Promise((r) => setTimeout(r, 10))
    }
    expect(received).not.toBeNull()
    expect(received!.version).toEqual({ gitHash: 'mdhash' })
    expect(received!.title).toBe('Note')
    expect(received!.requestInfo).toEqual({ pathname: 'shadowed' })
    expect(received!.content).toBe('note.md')
    expect(received!.wrapper).toBe('wrapper')
  })
})
