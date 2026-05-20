/**
 * Integration: example-src `POST /uploadImage` with local-disk adapter (no MySQL).
 *
 * Runs in default `bun test` — no `SKIP_DATABASE_TESTS=0` required.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fetchFromServer, startTestServer, stopTestServer, waitForServerHttp } from './helpers.js'

const thaliaRoot = path.resolve(import.meta.dirname, '../..')
const uploadsDir = path.join(thaliaRoot, 'websites', 'example-src', 'public', 'uploads')

describe('Integration: example-src local-disk upload (no database)', () => {
  let port!: number
  const writtenFiles: string[] = []

  beforeAll(async () => {
    await fsp.mkdir(uploadsDir, { recursive: true })
    const { port: p } = await startTestServer('example-src', { fresh: true })
    port = p
    await waitForServerHttp(port)
  })

  afterAll(async () => {
    for (const filePath of writtenFiles) {
      await fsp.unlink(filePath).catch(() => {})
    }
    await stopTestServer('example-src')
  })

  test('POST /uploadImage writes public/uploads file and returns JSON', async () => {
    const bytes = Buffer.from('example-src-ci-upload')
    const form = new FormData()
    form.append('fileToUpload', new File([bytes], 'ci-test.png', { type: 'image/png' }))

    const response = await fetchFromServer('/uploadImage', port, { method: 'POST', body: form })
    expect(response.status).toBe(200)

    const body = (await response.json()) as Record<string, unknown>
    expect(body.adapterName).toBe('local-disk')
    expect(String(body.url)).toMatch(/^\/uploads\/[a-f0-9]{32}\.png$/)

    const diskName = String(body.url).replace('/uploads/', '')
    const diskPath = path.join(uploadsDir, diskName)
    writtenFiles.push(diskPath)

    const onDisk = await fsp.readFile(diskPath)
    expect(Buffer.from(onDisk).equals(bytes)).toBe(true)
  })
})
