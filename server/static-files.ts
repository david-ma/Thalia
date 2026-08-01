/**
 * Shared static-file response helpers (MIME, headers, Range streaming).
 * Used by RequestHandler.tryStaticFile / tryPdf and by controllers (e.g. followDataFile).
 */

import type { IncomingMessage, ServerResponse } from 'http'
import fs from 'fs'
import path from 'path'

/** On-the-fly gzip only above this size (matches nginx-ish “large enough to bother”). */
export const GZIP_SIZE_THRESHOLD = 10 * 1024 // 10kb

/** Result of parsing `Range: bytes=…` for a known resource size (v1: single contiguous range). */
export type ParsedByteRange =
  | { kind: 'none' }
  | { kind: 'partial'; start: number; end: number }
  | { kind: 'unsatisfiable' }

export function getContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  const contentTypes: { [key: string]: string } = {
    html: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'text/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    xml: 'application/xml; charset=utf-8',
    yml: 'application/yaml; charset=utf-8',
    yaml: 'application/yaml; charset=utf-8',
    txt: 'text/plain; charset=utf-8',
    err: 'text/plain; charset=utf-8',
    log: 'text/plain; charset=utf-8',
    csv: 'text/csv; charset=utf-8',
    tsv: 'text/tab-separated-values; charset=utf-8',
    png: 'image/png',
    jpg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml; charset=utf-8',
    ico: 'image/x-icon',
    webp: 'image/webp',
    pdf: 'application/pdf',
    md: 'text/markdown; charset=utf-8',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    eot: 'font/eot',
    otf: 'font/otf',
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    flac: 'audio/flac',
    opus: 'audio/opus',
    webm: 'video/webm',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
  }
  return contentTypes[ext ?? ''] || 'application/octet-stream'
}

/** MIME type without parameters (`text/html; charset=utf-8` → `text/html`). */
export function mimeBaseType(contentType: string): string {
  return contentType.split(';')[0]?.trim().toLowerCase() ?? contentType
}

/**
 * Textual static assets compress well with gzip (same family as charset=utf-8 in getContentType).
 * Skips already-compressed binary (images, fonts, video, etc.).
 */
export function isGzipFriendlyMime(contentType: string): boolean {
  const base = mimeBaseType(contentType)
  return base.startsWith('text/') || base === 'application/json' || base === 'image/svg+xml'
}

/** MIME types the browser should display in-page rather than download. */
export const inlineContentTypes = new Set([
  'application/json',
  'application/pdf',
  'application/xml',
  'application/yaml',
  'text/css',
  'text/html',
  'text/javascript',
  'text/markdown',
  'text/plain',
  'text/csv',
  'text/tab-separated-values',
])

export function contentDispositionInline(filename: string): string {
  const escaped = filename.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `inline; filename="${escaped}"`
}

export function setStaticFileHeaders(
  res: ServerResponse,
  pathname: string,
  contentType: string,
  servedFilename?: string,
): void {
  res.setHeader('Content-Type', contentType)
  if (inlineContentTypes.has(mimeBaseType(contentType))) {
    const filename = servedFilename ?? path.basename(pathname)
    res.setHeader('Content-Disposition', contentDispositionInline(filename))
  }
}

/**
 * Parse a single `Range: bytes=start-end` or `bytes=start-` for a resource of `size` bytes.
 * Multipart ranges and suffix forms (`bytes=-N`) are ignored in v1 (treated as no range).
 * @see https://www.rfc-editor.org/rfc/rfc9110#name-range-requests
 */
export function parseBytesRange(
  rangeHeader: string | string[] | undefined,
  size: number,
): ParsedByteRange {
  if (rangeHeader == null) return { kind: 'none' }
  const raw = Array.isArray(rangeHeader) ? rangeHeader[0] : rangeHeader
  if (!raw || typeof raw !== 'string') return { kind: 'none' }

  const match = /^bytes=(\d+)-(\d*)$/i.exec(raw.trim())
  if (!match) return { kind: 'none' }

  const start = Number(match[1])
  const endToken = match[2]
  if (!Number.isFinite(start) || size === 0 || start >= size) {
    return { kind: 'unsatisfiable' }
  }

  const end = endToken === '' ? size - 1 : Math.min(Number(endToken), size - 1)
  if (!Number.isFinite(end) || end < start) {
    return { kind: 'unsatisfiable' }
  }

  return { kind: 'partial', start, end }
}

/** True when the client sent a Range header (skip on-the-fly gzip; Range + gzip is messy). */
export function hasRangeHeader(req: IncomingMessage): boolean {
  const range = req.headers['range']
  if (range == null) return false
  if (Array.isArray(range)) return range.length > 0 && Boolean(range[0])
  return range.length > 0
}

/**
 * Stream an uncompressed file, honouring a single byte Range when present.
 * Sets Accept-Ranges: bytes on 200/206.
 * Unsatisfiable ranges → 416 with Content-Range bytes star-slash-size (RFC 9110).
 *
 * Caller should already have set Content-Type (and Content-Disposition) via setStaticFileHeaders.
 */
export function streamStaticFile(
  req: IncomingMessage,
  res: ServerResponse,
  targetPath: string,
  finish: (message: string) => void,
  successLabel: string,
): void {
  const size = fs.statSync(targetPath).size
  const range = parseBytesRange(req.headers['range'], size)

  res.setHeader('Accept-Ranges', 'bytes')

  if (range.kind === 'unsatisfiable') {
    res.setHeader('Content-Range', `bytes */${size}`)
    res.writeHead(416)
    res.end()
    finish(`Range not satisfiable for ${successLabel}`)
    return
  }

  let streamStart: number | undefined
  let streamEnd: number | undefined
  if (range.kind === 'partial') {
    streamStart = range.start
    streamEnd = range.end
    const length = streamEnd - streamStart + 1
    res.setHeader('Content-Range', `bytes ${streamStart}-${streamEnd}/${size}`)
    res.setHeader('Content-Length', length.toString())
    res.writeHead(206)
  } else {
    res.setHeader('Content-Length', size.toString())
  }

  const stream = fs.createReadStream(
    targetPath,
    streamStart !== undefined && streamEnd !== undefined
      ? { start: streamStart, end: streamEnd }
      : undefined,
  )
  stream.on('error', (error) => {
    console.error(`Error streaming ${successLabel}:`, error)
    if (!res.headersSent) res.writeHead(500)
    res.end('Internal Server Error')
    finish(`Error streaming ${successLabel}`)
  })
  res.on('finish', () => {
    finish(`Successfully streamed ${successLabel}`)
  })
  stream.pipe(res)
}
