import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { Website } from '../../server/website.js'

function createMockResponse() {
  let statusCode = 0
  let body = ''
  let headersSent = false

  return {
    get statusCode() {
      return statusCode
    },
    get body() {
      return body
    },
    get headersSent() {
      return headersSent
    },
    writeHead(code: number, _headers?: Record<string, string>) {
      statusCode = code
      headersSent = true
    },
    end(chunk: string) {
      body = chunk
    },
  }
}

describe('Website template errors', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-template-error-'))
  const brokenPath = path.join(tmpDir, 'broken.hbs')
  const configDir = path.join(tmpDir, 'config')
  const srcDir = path.join(tmpDir, 'src')

  beforeAll(async () => {
    fs.mkdirSync(configDir)
    fs.mkdirSync(srcDir)
    fs.writeFileSync(
      path.join(configDir, 'config.ts'),
      `export const config = { domains: ['localhost'], controllers: {} }`,
    )
    fs.writeFileSync(brokenPath, '{{# if "broken-if" }}\nhello\n')
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('serveHandlebarsTemplate returns false and renders developer error page', async () => {
    const prevNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    try {
      const website = await Website.create({
        name: 'template-error-test',
        rootPath: tmpDir,
        mode: 'standalone',
        port: 0,
      })

      const res = createMockResponse()
      const ok = website.serveHandlebarsTemplate({
        res: res as any,
        templatePath: brokenPath,
        route: '/broken',
      })

      expect(ok).toBe(false)
      expect(res.statusCode).toBe(500)
      expect(res.body).toContain('Handlebars template error')
      expect(res.body).toContain('broken-if')
      expect(res.body).toContain('Copy for LLM')
      expect(res.body).toContain('Route: /broken')
    } finally {
      if (prevNodeEnv === undefined) {
        delete process.env.NODE_ENV
      } else {
        process.env.NODE_ENV = prevNodeEnv
      }
    }
  })
})
