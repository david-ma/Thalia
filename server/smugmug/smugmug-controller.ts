import type { IncomingMessage, ServerResponse } from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import type { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
import { images, type Image } from '../../models/smugmug.js'
import type { Machine } from '../types.js'
import { parseForm, type ParsedForm } from '../util.js'
import type { RequestInfo } from '../server.js'
import type { Website } from '../website.js'
import { normalizeSmugMugAlbumUri } from './album-uri.js'
import { requestHttpsUtf8 } from './https-request.js'
import { smugmugLogLine } from './log.js'
import { mysqlInsertIdFromDrizzleMysql2Result } from './mysql-insert-result.js'
import { parseSmugMugMultipartUploadResponse } from './multipart-upload-response.js'
import { fetchRemoteHttpsImageBytes, pickRemoteFileUrl } from './remote-image-fetch.js'
import { buildSmugMugNewImageInsert, type SmugMugUploadAck } from './save-image-map.js'
import { SmugMugClient, type SmugMugTokenSet } from './smugmug-client.js'
import {
  smugmugB64HmacSha1,
  smugmugBundleAuthorization,
  smugmugExpandParams,
  smugmugOauthEscape,
  smugmugSortParams,
} from './smugmug-oauth.js'
import {
  THALIA_SMUG_JSON_CLIENT_ERROR,
  THALIA_SMUG_JSON_SERVER_ERROR,
  THALIA_SMUG_MULTIPART_FAILED,
  THALIA_SMUG_NOT_CONFIGURED,
} from './upload-photo-errors.js'
import { parseSmugMugVerbosityAlbumImage } from './verbosity-response.js'

const UPLOAD_PHOTO_JSON_MAX_BYTES = 64 * 1024

/** Bounded JSON envelope for `{ uploadThingUrl/fileUrl/url, …metadata }` upload branch. */
export function readLimitedJsonObject(
  req: IncomingMessage,
  maxBytes = UPLOAD_PHOTO_JSON_MAX_BYTES,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    req.on('data', (d: unknown) => {
      const b = Buffer.isBuffer(d) ? d : Buffer.from(String(d))
      total += b.length
      if (total > maxBytes) {
        reject(new Error('JSON body too large'))
        req.destroy()
        return
      }
      chunks.push(b)
    })
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        if (!raw.trim()) {
          reject(new Error('Empty JSON body'))
          return
        }
        const v = JSON.parse(raw) as unknown
        if (v === null || typeof v !== 'object' || Array.isArray(v)) {
          reject(new Error('JSON body must be a plain object'))
          return
        }
        resolve(v as Record<string, unknown>)
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', (e: unknown) => reject(e instanceof Error ? e : new Error(String(e))))
  })
}

export class SmugMugUploader implements Machine {
  private website!: Website
  public name!: string
  public table!: MySqlTableWithColumns<any>
  /** Album key / API path / API URL fragment; normalized for `X-Smug-AlbumUri`. Secrets `album` overrides env/config. */
  private album = ''
  private tokens: SmugMugTokenSet | null = null
  private client: SmugMugClient | null = null

  /** Resolved from `SMUGMUG_OAUTH_CALLBACK_URL`, `config.smugmug.oauthCallbackUrl`, or localhost default. */
  private oauthCallbackResolved = 'http://localhost:3000/oauthCallback'

  constructor() {}

  public init(website: Website, name: string): void {
    this.website = website
    this.name = name
    this.table = images

    const cfg = website.config.smugmug
    this.oauthCallbackResolved =
      process.env.SMUGMUG_OAUTH_CALLBACK_URL?.trim() ||
      cfg?.oauthCallbackUrl?.trim() ||
      this.oauthCallbackResolved

    const envAlbum = process.env.SMUGMUG_ALBUM?.trim()
    const cfgAlbum = cfg?.album?.trim()
    this.album = envAlbum || cfgAlbum || ''

    const secretsPath = path.join(this.website.rootPath, 'config', 'secrets.js')

    void import(secretsPath)
      .then((mod: { smugmug?: Partial<SmugMugTokenSet> & { album?: string } }) => {
        const smug = mod.smugmug
        if (!smug) {
          smugmugLogLine({
            service: 'smugmug',
            level: 'warn',
            operation: 'init_no_smug_export',
            website: website.name,
            msg: 'config/secrets.js has no smugmug export; uploads disabled.',
          })
          return
        }

        this.tokens = {
          consumer_key: String(smug.consumer_key ?? process.env.SMUGMUG_CONSUMER_KEY ?? ''),
          consumer_secret: String(smug.consumer_secret ?? process.env.SMUGMUG_CONSUMER_SECRET ?? ''),
          oauth_token: String(smug.oauth_token ?? process.env.SMUGMUG_OAUTH_TOKEN ?? ''),
          oauth_token_secret: String(smug.oauth_token_secret ?? process.env.SMUGMUG_OAUTH_TOKEN_SECRET ?? ''),
        }

        const secretAlbum = typeof smug.album === 'string' ? smug.album.trim() : ''
        if (secretAlbum) {
          this.album = secretAlbum
        }

        if (!this.tokens.consumer_key || !this.tokens.consumer_secret) {
          smugmugLogLine({
            service: 'smugmug',
            level: 'warn',
            operation: 'init_missing_consumer',
            website: website.name,
            msg: 'consumer_key/consumer_secret missing; uploads disabled.',
          })
          this.client = null
          return
        }

        this.client = new SmugMugClient(this.tokens)

        if (this.tokens.oauth_token && this.tokens.oauth_token_secret) {
          return
        }

        const requestParams: Record<string, string> = {
          oauth_callback: 'oob',
          oauth_consumer_key: this.tokens.consumer_key,
          oauth_nonce: Math.random().toString().replace('0.', ''),
          oauth_signature_method: 'HMAC-SHA1',
          oauth_timestamp: String(Math.floor(Date.now() / 1000)),
          oauth_version: '1.0',
        }

        const sortedParams = smugmugSortParams(requestParams)
        const escapedParams = smugmugOauthEscape(smugmugExpandParams(sortedParams))
        const signatureBaseString = `GET&${smugmugOauthEscape(this.client.requestTokenUrl)}&${escapedParams}`

        requestParams.oauth_signature = smugmugB64HmacSha1(
          `${this.tokens.consumer_secret}&`,
          signatureBaseString,
        )

        const requestOptions = {
          hostname: 'api.smugmug.com',
          port: 443,
          path: '/services/oauth/1.0a/getRequestToken?' + new URLSearchParams(requestParams).toString(),
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        }

        const req = https.request(requestOptions, (res: any) => {
          let data = ''
          res.on('data', (chunk: any) => {
            data += chunk
          })

          res.on('end', () => {
            const response = data.split('&').reduce(
              (acc, item) => {
                const [key, value] = item.split('=')
                acc[key] = value
                return acc
              },
              {} as Record<string, string>,
            )

            if (response && response.oauth_callback_confirmed == 'true') {
              this.tokens!.oauth_token = response.oauth_token
              this.tokens!.oauth_token_secret = response.oauth_token_secret
            } else {
              smugmugLogLine({
                service: 'smugmug',
                level: 'error',
                operation: 'oauth_request_token_failed',
                website: website.name,
                hostname: 'api.smugmug.com',
                msg: 'Request token response not confirmed.',
              })
            }
          })
        })

        req.on('error', (e: unknown) => {
          smugmugLogLine({
            service: 'smugmug',
            level: 'error',
            operation: 'oauth_request_token_http',
            website: website.name,
            hostname: 'api.smugmug.com',
            msg: e instanceof Error ? e.message : String(e),
          })
        })

        req.end()
      })
      .catch((error: unknown) => {
        if (SmugMugUploader.isMissingSecretsModule(error)) {
          smugmugLogLine({
            service: 'smugmug',
            level: 'warn',
            operation: 'init_secrets_missing',
            website: website.name,
            msg: 'config/secrets.js not found or unreadable; uploads disabled.',
          })
          return
        }
        smugmugLogLine({
          service: 'smugmug',
          level: 'error',
          operation: 'init_secrets_load_failed',
          website: website.name,
          msg: error instanceof Error ? error.message : String(error),
        })
      })
  }

  private static isMissingSecretsModule(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error)
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as NodeJS.ErrnoException).code)
        : ''
    return (
      code === 'ERR_MODULE_NOT_FOUND' ||
      code === 'ENOENT' ||
      msg.includes('Cannot find module') ||
      msg.includes('Module not found')
    )
  }

  private smugRespondJson(res: ServerResponse, statusCode: number, payload: Record<string, string | undefined>): void {
    if (res.writableEnded || res.headersSent) return
    res.statusCode = statusCode
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(payload))
  }

  /** Non-null upload path requires consumer OAuth, access token, album key, and a loaded client. */
  private uploadNotReadyReason(): string | null {
    if (!this.client || !this.tokens) {
      return 'SmugMug is not configured (secrets missing or incomplete).'
    }
    const t = this.tokens
    if (!t.consumer_key || !t.consumer_secret) {
      return 'SmugMug consumer credentials are missing.'
    }
    if (!t.oauth_token || !t.oauth_token_secret) {
      return 'SmugMug OAuth is incomplete (access token not stored); finish pairing in config/secrets.js.'
    }
    if (!normalizeSmugMugAlbumUri(this.album)) {
      return 'SmugMug album is not set or is unusable for upload (bare album key, /api/v2/album/… path, or https://api.smugmug.com/api/v2/album/… URL via secrets.smugmug.album / SMUGMUG_ALBUM / config.smugmug.album).'
    }
    return null
  }

  public oauthCallback(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    if (!this.client || !this.tokens?.consumer_secret || !this.tokens?.oauth_token_secret) {
      this.smugRespondJson(res, 503, {
        error: 'SmugMug OAuth is not configured (missing secrets or request-token secret).',
      })
      return
    }

    const persistTokens = this.tokens
    const smugClient = this.client

    const query = requestInfo.query
    const oauthVerifier = Array.isArray(query.oauth_verifier) ? query.oauth_verifier[0] : query.oauth_verifier
    const oauthTokenQuery = Array.isArray(query.oauth_token) ? query.oauth_token[0] : query.oauth_token

    if (typeof oauthVerifier !== 'string' || !oauthVerifier || typeof oauthTokenQuery !== 'string' || !oauthTokenQuery) {
      this.smugRespondJson(res, 400, { error: 'SmugMug OAuth callback missing oauth_verifier or oauth_token.' })
      return
    }

    const tokenExchangeParams: Record<string, string> = {
      oauth_consumer_key: persistTokens.consumer_key,
      oauth_token: oauthTokenQuery,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: String(Date.now()),
      oauth_nonce: Math.random().toString().replace('0.', ''),
      oauth_verifier: oauthVerifier,
    }

    const sorted = smugmugSortParams(tokenExchangeParams)

    const normalized = encodeURIComponent(
      Object.entries(sorted)
        .map(([key, value]) => `${key}=${value}`)
        .join('&'),
    )
    const method = 'POST'

    tokenExchangeParams.oauth_signature = smugmugB64HmacSha1(
      `${persistTokens.consumer_secret}&${persistTokens.oauth_token_secret}`,
      `${method}&${encodeURIComponent(smugClient.accessTokenUrl)}&${normalized}`,
    )

    const options = {
      host: 'api.smugmug.com',
      port: 443,
      path: '/services/oauth/1.0a/getAccessToken?' + new URLSearchParams(tokenExchangeParams).toString(),
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
    }

    const httpsRequest = https.request(options, (httpsResponse: any) => {
      let data = ''
      httpsResponse.on('data', (chunk: any) => {
        data += chunk
      })

      httpsResponse.on('error', (e: any) => {
        smugmugLogLine({
          service: 'smugmug',
          level: 'error',
          operation: 'oauth_access_token_response',
          website: this.website.name,
          hostname: 'api.smugmug.com',
          msg: e instanceof Error ? e.message : String(e),
        })
      })

      httpsResponse.on('end', () => {
        const response = data.split('&').reduce(
          (acc, item) => {
            const [key, value] = item.split('=')
            acc[key] = value
            return acc
          },
          {} as Record<string, string>,
        )

        persistTokens.oauth_token = response.oauth_token
        persistTokens.oauth_token_secret = response.oauth_token_secret

        res.end(JSON.stringify(response))
      })
    })

    httpsRequest.on('error', (e: any) => {
      smugmugLogLine({
        service: 'smugmug',
        level: 'error',
        operation: 'oauth_access_token_request',
        website: this.website.name,
        hostname: 'api.smugmug.com',
        msg: e instanceof Error ? e.message : String(e),
      })
    })

    httpsRequest.end()
  }

  public controller(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) {
    const method = req.method ?? ''

    if (method != 'POST') {
      res.end('This should be a post')
      return
    }

    const reason = this.uploadNotReadyReason()
    if (reason) {
      smugmugLogLine({
        service: 'smugmug',
        level: 'warn',
        operation: 'upload_photo_not_configured',
        website: this.website.name,
        msg: `${THALIA_SMUG_NOT_CONFIGURED}: ${reason}`,
      })
      this.smugRespondJson(res, 503, {
        code: THALIA_SMUG_NOT_CONFIGURED,
        error: reason,
        hint:
          'Configure SmugMug in config/secrets.js (smugmug: consumer_key, consumer_secret, oauth_token, oauth_token_secret, album) or env SMUGMUG_*. Search codebase for THALIA_SMUG_NOT_CONFIGURED.',
      })
      return
    }

    const contentType = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()

    if (contentType === 'application/json') {
      readLimitedJsonObject(req)
        .then((body) => this.uploadPhotoFromRemoteJsonBody(body))
        .then((data) => {
          if (res.writableEnded || res.headersSent) return
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(data))
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err)
          const clientError =
            /\bEmpty JSON\b|\bInvalid JSON\b|\bJSON body\b|\bMissing upload URL\b|\bOnly https\b|\bImage host\b|\bImage URL\b|\bcredentials\b|\btoo large\b/i.test(
              msg,
            )
          const code = clientError ? THALIA_SMUG_JSON_CLIENT_ERROR : THALIA_SMUG_JSON_SERVER_ERROR
          smugmugLogLine({
            service: 'smugmug',
            level: 'error',
            operation: 'upload_photo_json',
            website: this.website.name,
            msg: `${code}: ${msg}`,
          })
          this.smugRespondJson(res, clientError ? 400 : 502, {
            code,
            error: msg,
            hint: clientError
              ? 'Fix JSON body or remote image URL (search THALIA_SMUG_JSON_CLIENT_ERROR).'
              : 'Check SmugMug / network in server logs (search THALIA_SMUG_JSON_SERVER_ERROR).',
          })
        })
      return
    }

    parseForm(res, req)
      .then(this.uploadImageToSmugmug.bind(this))
      .then((data) => {
        if (res.writableEnded || res.headersSent) return
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(data))
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        smugmugLogLine({
          service: 'smugmug',
          level: 'error',
          operation: 'upload_photo_form',
          website: this.website.name,
          msg: `${THALIA_SMUG_MULTIPART_FAILED}: ${msg}`,
        })
        if (res.writableEnded || res.headersSent) {
          return
        }
        this.smugRespondJson(res, 502, {
          code: THALIA_SMUG_MULTIPART_FAILED,
          error: 'Upload failed after the file was accepted.',
          hint:
            'See server logs for this request (THALIA_SMUG_MULTIPART_FAILED). If uploads never worked, fix SmugMug secrets/OAuth/album (THALIA_SMUG_NOT_CONFIGURED).',
        })
      })
  }

  private jsonFieldString(body: Record<string, unknown>, ...keys: string[]): string {
    for (const k of keys) {
      const v = body[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
    return ''
  }

  /**
   * UploadThing-style JSON: fetch `uploadThingUrl` / `fileUrl` / `url`, then same SmugMug path as multipart.
   */
  private async uploadPhotoFromRemoteJsonBody(body: Record<string, unknown>): Promise<Image> {
    const picked = pickRemoteFileUrl(body)
    if (!picked) {
      throw new Error('Missing upload URL (uploadThingUrl, fileUrl, or url)')
    }
    const { buffer, contentType } = await fetchRemoteHttpsImageBytes(picked, {
      log: { website: this.website.name },
    })

    let filename = this.jsonFieldString(body, 'filename', 'fileName')
    if (!filename) {
      try {
        const u = new URL(picked)
        const seg = u.pathname.split('/').filter(Boolean).pop()
        if (seg) filename = decodeURIComponent(seg)
      } catch {
        filename = ''
      }
    }
    if (!filename) filename = 'upload.bin'

    const caption = this.jsonFieldString(body, 'caption')
    const titleRaw = this.jsonFieldString(body, 'title')
    const title = titleRaw || filename || caption || ''
    const keywords =
      this.jsonFieldString(body, 'keywords') || title || caption || filename || this.website.name || ''

    const mime =
      this.jsonFieldString(body, 'mimeType', 'mimetype', 'contentType') ||
      contentType ||
      'application/octet-stream'

    return this.uploadBufferToSmugmugPipeline({
      bytes: buffer,
      caption,
      filename,
      title,
      keywords,
      mime,
    })
  }

  /**
   * Multipart form field `fileToUpload` — reads the temp file once, then shares the buffer path with JSON fetches.
   */
  private async uploadImageToSmugmug(form: ParsedForm) {
    const file = form.files.fileToUpload?.[0]
    if (!file) {
      return Promise.reject(new Error('No file provided'))
    }
    if (!this.client) {
      return Promise.reject(new Error('SmugMug client not initialised'))
    }

    const caption = form.fields.caption ?? ''
    const filename = form.fields.filename ?? file.originalFilename ?? ''
    const title = form.fields.title ?? filename ?? caption ?? ''
    const keywords = form.fields.keywords ?? title ?? caption ?? filename ?? this.website.name ?? ''

    const bytes = fs.readFileSync(file.filepath)
    return this.uploadBufferToSmugmugPipeline({
      bytes,
      caption,
      filename: filename || 'upload.bin',
      title,
      keywords,
      mime: file.mimetype ?? 'application/octet-stream',
    })
  }

  /**
   * MD5 dedupe against `images.archivedMD5`, then OAuth multipart POST to upload.smugmug.com.
   */
  private async uploadBufferToSmugmugPipeline(args: {
    bytes: Buffer
    caption: string
    filename: string
    title: string
    keywords: string
    mime: string
  }): Promise<Image> {
    const client = this.client
    if (!client) {
      throw new Error('SmugMug client not initialised')
    }

    const drizzle = this.website.db.drizzle
    const md5sum = crypto.createHash('md5').update(args.bytes).digest('hex')

    const existing = await drizzle.select().from(images).where(eq(images.archivedMD5, md5sum))
    if (existing.length > 0) {
      return existing[0]
    }

    const host = 'upload.smugmug.com'
    const uploadPath = '/'
    const targetUrl = `https://${host}${uploadPath}`
    const method = 'POST'
    const params = client.signRequest(method, targetUrl)
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16).substr(2, 8)
    const formData = SmugMugClient.createMultipartFormDataFromBytes(
      {
        buffer: args.bytes,
        originalFilename: args.filename,
        mimetype: args.mime,
      },
      boundary,
    )

    const { statusCode, bodyUtf8 } = await requestHttpsUtf8({
      hostname: host,
      port: 443,
      path: uploadPath,
      method,
      headers: {
        Authorization: smugmugBundleAuthorization(targetUrl, params),
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': formData.length,
        'X-Smug-AlbumUri': normalizeSmugMugAlbumUri(this.album),
        'X-Smug-Caption': args.caption,
        'X-Smug-FileName': args.filename,
        'X-Smug-Keywords': args.keywords,
        'X-Smug-ResponseType': 'JSON',
        'X-Smug-Title': args.title,
        'X-Smug-Version': 'v2',
      },
      body: formData,
      log: {
        website: this.website.name,
        operation: 'upload_multipart',
        filename: args.filename,
      },
    })

    const ack = parseSmugMugMultipartUploadResponse(statusCode, bodyUtf8)
    const insertResult = await this.saveImage(ack)
    const insertIdNum = mysqlInsertIdFromDrizzleMysql2Result(insertResult)
    if (insertIdNum === undefined) {
      throw new Error('Image insert returned no insertId')
    }
    const imageResults = await drizzle.select().from(images).where(eq(images.id, insertIdNum))
    const row = (imageResults as Image[])[0]
    if (row === undefined) {
      throw new Error('Image row missing after insert')
    }
    return row
  }

  private saveImage(data: SmugMugUploadAck): Promise<unknown> {
    const AlbumImageUri = data.Image.AlbumImageUri
    if (typeof AlbumImageUri !== 'string' || !AlbumImageUri.trim()) {
      return Promise.reject(new Error('SmugMug upload ack missing Image.AlbumImageUri'))
    }
    const client = this.client
    if (!client) {
      return Promise.reject(new Error('SmugMug client not initialised'))
    }

    return client.smugmugApiCall(AlbumImageUri, 'GET', this.website.name).then((response: string) => {
      const ai = parseSmugMugVerbosityAlbumImage(response)
      const drizzle = this.website.db.drizzle
      const values = buildSmugMugNewImageInsert(data, ai)
      return drizzle.insert(images).values(values)
    })
  }
}
