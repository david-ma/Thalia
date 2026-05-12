/**
 * Deterministic OAuth helpers + SmugMugClient.signRequest (mocked random/time).
 */

import { describe, expect, test, spyOn } from 'bun:test'
import {
  smugmugB64HmacSha1,
  smugmugBundleAuthorization,
  smugmugExpandParams,
  smugmugOauthEscape,
  smugmugSortParams,
} from '../../server/images/smugmug/oauth.js'
import { SmugMugClient, type SmugMugTokenSet } from '../../server/images/smugmug/client.js'
import { loadSmugmugOAuthSignatureFixture } from '../helpers/smugmug-fixtures.js'

describe('SmugMug OAuth helpers', () => {
  test('smugmugOauthEscape keeps RFC 5849 “unreserved” exceptions', () => {
    expect(smugmugOauthEscape("!'()*")).toBe('%21%27%28%29%2A')
  })

  test('smugmugBundleAuthorization encodes oauth_signature per Appendix A (no raw + or / in header)', () => {
    const header = smugmugBundleAuthorization('https://api.example/', {
      oauth_consumer_key: 'ck',
      oauth_signature: 'a+b/c=',
      oauth_nonce: 'n',
    })
    expect(header).toMatch(/oauth_signature="[^"]*%2B[^"]*%2F[^"]*%3D"/)
    expect(header).not.toContain('oauth_signature="a+')
  })

  test('smugmugSortParams + expand + HMAC matches golden vector file', () => {
    const fx = loadSmugmugOAuthSignatureFixture()
    const params: Record<string, string> = {
      oauth_consumer_key: fx.tokens.consumer_key,
      oauth_nonce: fx.expectedNonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: fx.expectedTimestamp,
      oauth_token: fx.tokens.oauth_token,
      oauth_version: '1.0',
      _verbosity: '1',
    }
    const sorted = smugmugSortParams(params)
    const escapedParamString = smugmugOauthEscape(smugmugExpandParams(sorted))
    const baseString = `${fx.method}&${smugmugOauthEscape('https://api.smugmug.com/api/v2/album/AbCd')}&${escapedParamString}`
    expect(baseString).toBe(fx.signatureBaseString)
    const sig = smugmugB64HmacSha1(
      `${fx.tokens.consumer_secret}&${fx.tokens.oauth_token_secret}`,
      baseString,
    )
    expect(sig).toBe(fx.expectedOAuthSignature)
  })
})

describe('SmugMugClient.signRequest', () => {
  test('matches golden vector with mocked random + time', () => {
    const fx = loadSmugmugOAuthSignatureFixture()
    const tokens: SmugMugTokenSet = { ...fx.tokens }
    const randomSpy = spyOn(Math, 'random').mockReturnValue(fx.mockRandom)
    const dateSpy = spyOn(Date, 'now').mockReturnValue(fx.mockDateNowMs)
    try {
      const client = new SmugMugClient(tokens)
      const params = client.signRequest(fx.method, fx.targetUrl)

      expect(params.oauth_nonce).toBe(fx.expectedNonce)
      expect(params.oauth_timestamp).toBe(fx.expectedTimestamp)
      expect(params.oauth_signature).toBe(fx.expectedOAuthSignature)
    } finally {
      randomSpy.mockRestore()
      dateSpy.mockRestore()
    }
  })
})
