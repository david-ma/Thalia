import { describe, expect, test } from 'bun:test'
import { requestHttpsUtf8 } from '../../server/images/https-request.js'

describe('requestHttpsUtf8', () => {
  test('returns a defined HTTP status from SmugMug host', async () => {
    const { statusCode, bodyUtf8 } = await requestHttpsUtf8({
      hostname: 'api.smugmug.com',
      path: '/',
      method: 'GET',
      headers: { Accept: '*/*' },
      timeoutMs: 15_000,
    })
    expect(statusCode).toBeGreaterThanOrEqual(200)
    expect(statusCode).toBeLessThan(600)
    expect(typeof bodyUtf8).toBe('string')
  }, 20_000)
})
