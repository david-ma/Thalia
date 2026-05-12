/**
 * Shared HTTPS client for SmugMug hosts (timeout, UTF-8 body accumulation).
 */

import https from 'https'
import type { IncomingMessage } from 'http'
import type { OutgoingHttpHeaders } from 'http'

import { SMUGMUG_HTTPS_TIMEOUT_MS } from './smugmug/constants.js'
import { smugmugLogLine } from './log.js'

export type SmugMugHttpsLogContext = {
  website?: string
  operation: string
  filename?: string
}

export type RequestHttpsUtf8Params = {
  hostname: string
  port?: number
  path: string
  method: string
  headers: OutgoingHttpHeaders
  /** Optional request body (e.g. multipart buffer). */
  body?: Buffer
  timeoutMs?: number
  /** Structured log line on success or failure (no secrets). */
  log?: SmugMugHttpsLogContext
}

export type HttpsUtf8Response = {
  statusCode: number | undefined
  bodyUtf8: string
}

/**
 * Single-shot HTTPS request: socket timeout, collects response as UTF-8 text (JSON / text APIs).
 * Does **not** enforce HTTP success — callers check `statusCode` or parse error bodies.
 */
export function requestHttpsUtf8(params: RequestHttpsUtf8Params): Promise<HttpsUtf8Response> {
  const timeoutMs = params.timeoutMs ?? SMUGMUG_HTTPS_TIMEOUT_MS
  const t0 = Date.now()
  const log = params.log
  const pathForLog =
    params.path.length > 240 ? `${params.path.slice(0, 240)}…` : params.path

  const p = new Promise<HttpsUtf8Response>((resolve, reject) => {
    const req = https.request(
      {
        hostname: params.hostname,
        port: params.port ?? 443,
        path: params.path,
        method: params.method,
        headers: params.headers,
      },
      (res: IncomingMessage) => {
        let data = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: unknown) => {
          data += chunk as string
        })
        res.on('error', (e: unknown) => {
          reject(e instanceof Error ? e : new Error(String(e)))
        })
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, bodyUtf8: data })
        })
      },
    )

    req.setTimeout(timeoutMs, () => {
      req.destroy()
      reject(new Error('HTTPS request timed out'))
    })

    req.on('error', (e: unknown) => {
      reject(e instanceof Error ? e : new Error(String(e)))
    })

    if (params.body) {
      req.write(params.body)
    }
    req.end()
  })

  return p.then((result) => {
    if (log) {
      smugmugLogLine({
        service: 'smugmug',
        level: 'info',
        operation: log.operation,
        website: log.website,
        hostname: params.hostname,
        method: params.method,
        path: pathForLog,
        durationMs: Date.now() - t0,
        httpStatus: result.statusCode,
        filename: log.filename,
      })
    }
    return result
  }).catch((e: unknown) => {
    if (log) {
      smugmugLogLine({
        service: 'smugmug',
        level: 'error',
        operation: log.operation,
        website: log.website,
        hostname: params.hostname,
        method: params.method,
        path: pathForLog,
        durationMs: Date.now() - t0,
        filename: log.filename,
        msg: e instanceof Error ? e.message : String(e),
      })
    }
    throw e
  })
}
