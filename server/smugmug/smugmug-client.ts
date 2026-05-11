/**
 * Thin SmugMug API v2 + OAuth-signed HTTP client for Thalia (`SmugMugUploader` consumes this).
 */

import fs from 'fs'
import https from 'https'
import type { IncomingMessage } from 'http'
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
    return new Promise((resolve, reject) => {
      const urlWithVerbosity = `${path}?_verbosity=1`
      const targetUrl = `${SmugMugClient.BASE_URL}${urlWithVerbosity}`
      const params = this.signRequest(method, targetUrl)

      const options = {
        host: 'api.smugmug.com',
        port: 443,
        path: urlWithVerbosity,
        method,
        headers: {
          Authorization: smugmugBundleAuthorization(targetUrl, params),
          Accept: 'application/json',
          'X-Smug-ResponseType': 'JSON',
        },
      }

      const httpsRequest = https.request(options, (httpsResponse: IncomingMessage) => {
        let data = ''
        httpsResponse.on('data', (chunk: unknown) => {
          data += chunk as string
        })
        httpsResponse.on('end', () => {
          resolve(data)
        })
      })

      httpsRequest.on('error', (e: unknown) => {
        reject(e)
      })

      httpsRequest.end()
    })
  }

  static createMultipartFormData(
    file: { originalFilename?: string | null; mimetype?: string | null; filepath: string },
    boundary: string,
  ): Buffer {
    const parts = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="' + file.originalFilename + '"',
      'Content-Type: ' + file.mimetype,
      '',
      fs.readFileSync(file.filepath),
      '',
      `--${boundary}--`,
    ]

    return Buffer.concat(parts.map((part) => (typeof part === 'string' ? Buffer.from(part + '\r\n') : part)))
  }
}
