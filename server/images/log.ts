/**
 * Token-safe structured logs for SmugMug (Phase F `5a`).
 * One JSON object per line; never emit oauth_* values or raw Authorization headers.
 */

export type SmugmugLogLevel = 'info' | 'warn' | 'error'

export type SmugmugLogEvent = {
  service: 'smugmug'
  level: SmugmugLogLevel
  operation: string
  website?: string
  hostname?: string
  method?: string
  /** API path or `/` — omit query strings that might carry secrets */
  path?: string
  durationMs?: number
  httpStatus?: number
  byteLength?: number
  filename?: string
  /** Sanitised; run through {@link redactLogText} before serialising */
  msg?: string
}

/** Strip OAuth-style query params and long tokens from free-text error messages. */
export function redactLogText(s: string, maxLen = 480): string {
  let t = s.slice(0, maxLen)
  t = t.replace(/[?&](oauth_[^=&]+)=([^&\s"'<>]+)/gi, (_full, key: string) => `${key}=[redacted]`)
  t = t.replace(/\bconsumer_(key|secret)=\S+/gi, 'consumer_$1=[redacted]')
  return t
}

export function smugmugLogLine(evt: SmugmugLogEvent): void {
  const msg = evt.msg !== undefined ? redactLogText(evt.msg) : undefined
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    ...evt,
  }
  if (msg !== undefined) {
    payload.msg = msg
  } else {
    delete payload.msg
  }

  const line = JSON.stringify(payload)
  if (evt.level === 'error') {
    console.error(line)
  } else if (evt.level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}
