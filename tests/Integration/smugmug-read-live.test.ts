/**
 * Optional **read-only** SmugMug API check (single signed GET).
 *
 * Never enable writes: do not set `SMUGMUG_WRITE` when running this suite.
 *
 * CI: Default workflow does **not** set `SMUGMUG_READ_CI`; opt in with repo secrets + env if desired.
 */

import { describe, expect, test } from 'bun:test'
import { SmugMugClient, type SmugMugTokenSet } from '../../server/images/smugmug/client.js'

const smugReadCi = process.env.SMUGMUG_READ_CI === '1'
const smugWrite = process.env.SMUGMUG_WRITE === '1'

function liveTokenSet(): SmugMugTokenSet | null {
  const ck = process.env.SMUGMUG_CONSUMER_KEY?.trim()
  const cs = process.env.SMUGMUG_CONSUMER_SECRET?.trim()
  const ot = process.env.SMUGMUG_OAUTH_TOKEN?.trim()
  const ots = process.env.SMUGMUG_OAUTH_TOKEN_SECRET?.trim()
  if (!ck || !cs || !ot || !ots) return null
  return {
    consumer_key: ck,
    consumer_secret: cs,
    oauth_token: ot,
    oauth_token_secret: ots,
  }
}

const tokens = liveTokenSet()
const runLive = smugReadCi && !smugWrite && tokens !== null

describe.skipIf(!runLive)('SmugMug live read (SMUGMUG_READ_CI=1)', () => {
  test('GET /api/v2/user!authuser returns Response JSON', async () => {
    const client = new SmugMugClient(tokens!)
    const body = await client.smugmugApiCall('/api/v2/user!authuser', 'GET', 'smug_read_live_ci')
    expect(body.length).toBeGreaterThan(10)
    const json = JSON.parse(body) as { Response?: unknown }
    expect(json.Response).toBeDefined()
  })
})
