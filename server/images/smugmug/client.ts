/**
 * Thin SmugMug API v2 + OAuth-signed HTTP client for Thalia (`ThaliaImageUploader` consumes this).
 */

import { requestHttpsUtf8 } from '../../util/https-request.js'
import {
  smugmugB64HmacSha1,
  smugmugBundleAuthorization,
  smugmugExpandParams,
  smugmugOauthEscape,
  smugmugSortParams,
} from './oauth.js'

export type SmugMugTokenSet = {
  consumer_key: string
  consumer_secret: string
  oauth_token: string
  oauth_token_secret: string
}

export class SmugMugClient {
  static readonly BASE_URL = 'https://api.smugmug.com'

  constructor(private tokens: SmugMugTokenSet) {}

  get authorizeUrl(): string {
    return `${SmugMugClient.BASE_URL}/services/oauth/1.0a/authorize`
  }

  get accessTokenUrl(): string {
    return `${SmugMugClient.BASE_URL}/services/oauth/1.0a/getAccessToken`
  }

  get requestTokenUrl(): string {
    return `${SmugMugClient.BASE_URL}/services/oauth/1.0a/getRequestToken`
  }

  /** OAuth 1.0a HMAC-SHA1 signing; `oauth_signature` is RFC 5849 Appendix A–encoded in {@link smugmugBundleAuthorization}. */
  signRequest(method: string, targetUrl: string): Record<string, string> {
    const urlObj = new URL(targetUrl)
    const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`

    const queryParams: Record<string, string> = {}
    urlObj.searchParams.forEach((value, key) => {
      queryParams[key] = value
    })

    const params: Record<string, string> = {
      oauth_consumer_key: this.tokens.consumer_key,
      oauth_nonce: Math.random().toString().replace('0.', ''),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: String(Math.floor(Date.now() / 1000)),
      oauth_token: this.tokens.oauth_token,
      oauth_version: '1.0',
      ...queryParams,
    }

    const sortedParams = smugmugSortParams(params)
    const escapedParams = smugmugOauthEscape(smugmugExpandParams(sortedParams))

    params.oauth_signature = smugmugB64HmacSha1(
      `${this.tokens.consumer_secret}&${this.tokens.oauth_token_secret}`,
      `${method}&${smugmugOauthEscape(baseUrl)}&${escapedParams}`,
    )

    return params
  }

  /**
   * Signed `GET …/path?_verbosity=1` against `api.smugmug.com`; resolves raw JSON string body (legacy parity).
   */
  smugmugApiCall(path: string, method = 'GET', logWebsite?: string): Promise<string> {
    const urlWithVerbosity = `${path}?_verbosity=1`
    const targetUrl = `${SmugMugClient.BASE_URL}${urlWithVerbosity}`
    const params = this.signRequest(method, targetUrl)

    return requestHttpsUtf8({
      hostname: 'api.smugmug.com',
      port: 443,
      path: urlWithVerbosity,
      method,
      headers: {
        Authorization: smugmugBundleAuthorization(targetUrl, params),
        Accept: 'application/json',
        'X-Smug-ResponseType': 'JSON',
      },
      log:
        logWebsite !== undefined
          ? { service: 'smugmug', website: logWebsite, operation: 'smugmug_api_get' }
          : undefined,
    }).then(({ statusCode, bodyUtf8 }) => {
      if (statusCode === undefined || statusCode < 200 || statusCode >= 300) {
        throw new Error(`SmugMug API request failed (HTTP ${statusCode ?? 'unknown'})`)
      }
      return bodyUtf8
    })
  }

  /**
   * POST `getAccessToken` with OAuth 1.0a signing (same rules as {@link signRequest}).
   * On success updates `this.tokens.oauth_token` and `oauth_token_secret` from the response body.
   * On failure restores the token pair from before the call.
   */
  exchangeAccessToken(
    oauthVerifier: string,
    oauthTokenFromCallback: string,
    website?: string,
  ): Promise<Record<string, string>> {
    const prevToken = this.tokens.oauth_token
    const prevSecret = this.tokens.oauth_token_secret
    this.tokens.oauth_token = oauthTokenFromCallback

    const path = '/services/oauth/1.0a/getAccessToken'
    const targetUrl = `${SmugMugClient.BASE_URL}${path}?${new URLSearchParams({ oauth_verifier: oauthVerifier }).toString()}`
    const signed = this.signRequest('POST', targetUrl)
    const query = new URLSearchParams(signed).toString()
    const fullPath = `${path}?${query}`

    return requestHttpsUtf8({
      hostname: 'api.smugmug.com',
      port: 443,
      path: fullPath,
      method: 'POST',
      headers: { Accept: 'application/json' },
      log:
        website !== undefined
          ? { service: 'smugmug', website, operation: 'oauth_access_token' }
          : undefined,
    })
      .then(({ statusCode, bodyUtf8 }) => {
        if (statusCode === undefined || statusCode < 200 || statusCode >= 300) {
          throw new Error(`SmugMug access token exchange failed (HTTP ${statusCode ?? 'unknown'})`)
        }
        const parsed = SmugMugClient.parseOAuthFormBody(bodyUtf8)
        if (typeof parsed.oauth_token === 'string') {
          this.tokens.oauth_token = parsed.oauth_token
        }
        if (typeof parsed.oauth_token_secret === 'string') {
          this.tokens.oauth_token_secret = parsed.oauth_token_secret
        }
        return parsed
      })
      .catch((e: unknown) => {
        this.tokens.oauth_token = prevToken
        this.tokens.oauth_token_secret = prevSecret
        throw e
      })
  }

  /** Parse `a=b&c=d` form body from SmugMug OAuth token responses (values are not URL-decoded). */
  static parseOAuthFormBody(body: string): Record<string, string> {
    return body.split('&').reduce(
      (acc, item) => {
        const eq = item.indexOf('=')
        const key = eq >= 0 ? item.slice(0, eq) : item
        const value = eq >= 0 ? item.slice(eq + 1) : ''
        if (key) acc[key] = value
        return acc
      },
      {} as Record<string, string>,
    )
  }

  /**
   * Multipart `file` part for upload.smugmug.com — same wire format as legacy disk-based helper.
   */
  static createMultipartFormDataFromBytes(
    file: { buffer: Buffer; originalFilename?: string | null; mimetype?: string | null },
    boundary: string,
  ): Buffer {
    const name = file.originalFilename ?? 'upload.bin'
    const mime = file.mimetype ?? 'application/octet-stream'
    const parts = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="' + name + '"',
      'Content-Type: ' + mime,
      '',
      file.buffer,
      '',
      `--${boundary}--`,
    ]

    return Buffer.concat(parts.map((part) => (typeof part === 'string' ? Buffer.from(part + '\r\n') : part)))
  }
}
