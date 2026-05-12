import { describe, expect, test } from 'bun:test'
import { redactLogText } from '../../server/smugmug/log.js'

describe('redactLogText', () => {
  test('strips oauth query pairs from error text', () => {
    const raw =
      'failed https://api.smugmug.com/x?oauth_token=secret123&oauth_verifier=vvv&oauth_consumer_key=ck'
    const out = redactLogText(raw)
    expect(out).not.toContain('secret123')
    expect(out).not.toContain('vvv')
    expect(out).toContain('oauth_token=[redacted]')
  })

  test('strips consumer_secret= from text', () => {
    expect(redactLogText('err consumer_secret=abc&x=1')).toMatch(/consumer_secret=\[redacted\]/)
  })
})
