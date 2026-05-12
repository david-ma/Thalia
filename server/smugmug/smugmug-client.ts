/**
 * Thin SmugMug API v2 + OAuth-signed HTTP client for Thalia (`SmugMugUploader` consumes this).
 */

import fs from 'fs'

import { requestHttpsUtf8 } from './https-request.js'
import {
  smugmugB64HmacSha1,
  smugmugBundleAuthorization,
  smugmugExpandParams,
  smugmugOauthEscape,
  smugmugSortParams,
} from './smugmug-oauth.js'

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

  /** Same algorithm as legacy `SmugMugUploader.signRequest` — includes `+/` signature retry workaround. */
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

    return params.oauth_signature.match(/[\+\/]/)
      ? this.signRequest(method, targetUrl)
      : params
  }

  /**
   * Signed `GET …/path?_verbosity=1` against `api.smugmug.com`; resolves raw JSON string body (legacy parity).
   */
  smugmugApiCall(path: string, method = 'GET'): Promise<string> {
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
    }).then(({ statusCode, bodyUtf8 }) => {
      if (statusCode === undefined || statusCode < 200 || statusCode >= 300) {
        throw new Error(`SmugMug API request failed (HTTP ${statusCode ?? 'unknown'})`)
      }
      return bodyUtf8
    })
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

  static createMultipartFormData(
    file: { originalFilename?: string | null; mimetype?: string | null; filepath: string },
    boundary: string,
  ): Buffer {
    const buffer = fs.readFileSync(file.filepath)
    return SmugMugClient.createMultipartFormDataFromBytes(
      {
        buffer,
        originalFilename: file.originalFilename,
        mimetype: file.mimetype,
      },
      boundary,
    )
  }
}
