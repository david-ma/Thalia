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

describe('Website handlebarsHelpers', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-handlebars-helpers-'))
  const configDir = path.join(tmpDir, 'config')
  const srcDir = path.join(tmpDir, 'src')

  beforeAll(() => {
    fs.mkdirSync(configDir)
    fs.mkdirSync(srcDir)
    fs.writeFileSync(
      path.join(configDir, 'config.ts'),
      `export const config = {
        domains: ['localhost'],
        controllers: {},
        handlebarsHelpers: {
          ping: () => 'pong',
        },
      }`,
    )
    fs.writeFileSync(path.join(srcDir, 'index.hbs'), '<p>{{ping}}</p>')
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('registers config helpers after create() when NODE_ENV=test', async () => {
    const prevNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'test'
    try {
      const website = await Website.create({
        name: 'handlebars-helpers-test',
        rootPath: tmpDir,
        mode: 'standalone',
        port: 0,
      })

      const res = createMockResponse()
      const ok = website.serveHandlebarsTemplate({
        res: res as any,
        template: 'index',
      })

      expect(ok).toBe(true)
      expect(res.statusCode).toBe(200)
      expect(res.body).toContain('pong')
      expect(res.body).not.toContain('{{ping}}')
    } finally {
      if (prevNodeEnv === undefined) {
        delete process.env.NODE_ENV
      } else {
        process.env.NODE_ENV = prevNodeEnv
      }
    }
  })
})
