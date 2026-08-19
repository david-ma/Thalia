import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import Handlebars from 'handlebars'
import type { IncomingMessage, ServerResponse } from 'http'
import {
  Website,
  compileHandlebarsTemplate,
  createSafeHandlebars,
} from '../../server/website.js'
import { wrap } from '../../server/controllers.js'
import { renderMarkdownPage } from '../../server/markdown.js'
import type { RequestInfo } from '../../server/server.js'

function makeRes() {
  let body = ''
  let status = 200
  const res = {
    headersSent: false,
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

describe('compileHandlebarsTemplate', () => {
  test('returns an already-compiled template instead of throwing', () => {
    const hb = Handlebars.create()
    const compiled = hb.compile('<p>{{name}}</p>')
    const again = compileHandlebarsTemplate(hb, compiled)
    expect(again({ name: 'Ada' })).toBe('<p>Ada</p>')
  })

  test('createSafeHandlebars compile() is idempotent', () => {
    const hb = createSafeHandlebars()
    const compiled = hb.compile('<p>{{name}}</p>')
    expect(() => hb.compile(compiled)).not.toThrow()
    expect(hb.compile(compiled)({ name: 'Ada' })).toBe('<p>Ada</p>')
  })

  test('raw Handlebars.compile throws on a compiled template (documents the 500)', () => {
    const hb = Handlebars.create()
    const compiled = hb.compile('<p>x</p>')
    expect(() => hb.compile(compiled as unknown as string)).toThrow(/string or Handlebars AST/)
  })
})

describe('wrap after markdown has compiled wrapper', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-ecom-wrap-'))
  const configDir = path.join(tmpDir, 'config')
  const srcDir = path.join(tmpDir, 'src')

  beforeAll(() => {
    fs.mkdirSync(configDir)
    fs.mkdirSync(srcDir)
    fs.writeFileSync(
      path.join(configDir, 'config.ts'),
      `export const config = { domains: ['localhost'], controllers: {} }`,
    )
    fs.writeFileSync(
      path.join(srcDir, 'index.md'),
      `---
title: Home
hide_tabs: true
---

# Home

[Ecom](/ecom)
`,
    )
    fs.writeFileSync(
      path.join(srcDir, 'ecom.hbs'),
      `<section class="blogpost"><h3 class="section-header">Customers</h3></section>`,
    )
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('production wrap(ecom) still works after rendering the markdown homepage', async () => {
    const prevNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const website = await Website.create({
        name: 'ecom-wrap-after-md',
        rootPath: tmpDir,
        mode: 'standalone',
        port: 0,
      })

      const requestInfo = {
        pathname: '/',
        query: {},
        ip: '127.0.0.1',
        host: 'localhost',
      } as unknown as RequestInfo

      const homeHtml = renderMarkdownPage(
        website.handlebars,
        fs.readFileSync(path.join(srcDir, 'index.md'), 'utf8'),
        { requestInfo, version: website.version },
      )
      expect(homeHtml).toContain('Ecom')
      expect(typeof website.handlebars.partials['wrapper']).toBe('function')

      const res = makeRes()
      wrap('ecom.hbs')(res, {} as IncomingMessage, website, {
        ...requestInfo,
        pathname: '/ecom',
      } as RequestInfo)

      expect(res.statusCode).toBe(200)
      expect(res.body).toContain('<html')
      expect(res.body).toContain('Customers')
      expect(res.body).not.toContain('You must pass a string or Handlebars AST')

      await website.closeDatabase()
    } finally {
      if (prevNodeEnv === undefined) {
        delete process.env.NODE_ENV
      } else {
        process.env.NODE_ENV = prevNodeEnv
      }
    }
  })
})
