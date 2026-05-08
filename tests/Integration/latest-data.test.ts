/**
 * Integration test for `latestData` wired into example-src.
 *
 * example-src/config/config.ts exposes:
 *   data: { logs: latestData('logs', { type: 'txt', sort: 'dateCreated' }) }
 *
 * and example-src/data/logs/ contains a couple of dated .txt fixtures.
 *
 * This test only verifies the controller's 302 + Location contract; the
 * downstream serving of the redirected file is the static handler's job
 * and is covered elsewhere.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import fs from 'fs'
import path from 'path'
import { startTestServer, stopTestServer, fetchFromServer } from './helpers.js'

const PROJECT = 'example-src'

describe('latestData controller (example-src /data/logs)', () => {
  let port: number
  let logsDir: string
  let knownLogs: string[]

  beforeAll(async () => {
    const info = await startTestServer(PROJECT)
    port = info.port

    const thaliaRoot = path.resolve(import.meta.dirname, '../..')
    logsDir = path.join(thaliaRoot, 'websites', PROJECT, 'data', 'logs')
    knownLogs = fs
      .readdirSync(logsDir)
      .filter((f) => f.endsWith('.txt'))

    await new Promise((r) => setTimeout(r, 200))
  })

  afterAll(async () => {
    await stopTestServer(PROJECT)
  })

  test('precondition: example-src has at least one .txt log fixture', () => {
    expect(knownLogs.length).toBeGreaterThan(0)
  })

  test('GET /data/logs returns 302 with a Location pointing to a known log', async () => {
    const response = await fetchFromServer('/data/logs', port, { redirect: 'manual' })
    expect(response.status).toBe(302)

    const location = response.headers.get('location')
    expect(location).not.toBeNull()
    // Location must look like /logs/<one of the known filenames>
    expect(location).toMatch(/^\/logs\/.+\.txt$/)
    const filename = location!.replace(/^\/logs\//, '')
    expect(knownLogs).toContain(filename)
  })
})
