/**
 * Database boot / reconnect helpers for serve-first MariaDB recovery.
 *
 * On host reboot, PM2 often resurrects Thalia before Docker MariaDB is healthy.
 * Immediate init still runs once; on failure the website keeps listening and
 * retries in the background using a fixed backoff schedule.
 */

/** Default delays (seconds) after each failed attempt before the next try. */
export const DEFAULT_DB_RETRY_DELAYS_SECONDS: readonly number[] = [
  5, 10, 20, 30, 60, 90, 120, 180, 240, 300,
]

/** Boot behaviour when `config.database` is set. Default remains optional. */
export type DatabaseBootMode = 'optional' // reserved: 'require'

export type DatabaseBootConfig = {
  mode?: DatabaseBootMode
  /** Seconds to wait after each failed attempt before retrying (after the immediate first try). */
  retryDelaysSeconds?: number[]
}

/** Snapshot for `/health` and operator logs. */
export type DatabaseReconnectStatus = {
  reconnecting: boolean
  /** 0 = initial boot attempt only; 1+ = scheduled reconnect attempt index. */
  attemptIndex: number
  /** ISO timestamp of the next scheduled attempt, or null when not waiting. */
  nextAttemptAt: string | null
  /** True after the backoff schedule finished without a successful connect. */
  scheduleExhausted: boolean
}

export function idleDatabaseReconnectStatus(): DatabaseReconnectStatus {
  return {
    reconnecting: false,
    attemptIndex: 0,
    nextAttemptAt: null,
    scheduleExhausted: false,
  }
}

/**
 * Resolve retry delays: env `THALIA_DB_RETRY_DELAYS` (comma-separated seconds)
 * overrides config, which overrides the framework default.
 */
export function resolveDbRetryDelaysSeconds(
  boot?: DatabaseBootConfig,
  env: NodeJS.ProcessEnv = process.env,
): number[] {
  const fromEnv = parseDelayList(env.THALIA_DB_RETRY_DELAYS)
  if (fromEnv) return fromEnv

  const fromConfig = sanitiseDelayList(boot?.retryDelaysSeconds)
  if (fromConfig) return fromConfig

  return [...DEFAULT_DB_RETRY_DELAYS_SECONDS]
}

function parseDelayList(raw: string | undefined): number[] | null {
  if (!raw?.trim()) return null
  return sanitiseDelayList(
    raw.split(',').map((part) => Number(part.trim())),
  )
}

function sanitiseDelayList(values: number[] | undefined): number[] | null {
  if (!values?.length) return null
  const cleaned = values.filter((n) => Number.isFinite(n) && n >= 0)
  return cleaned.length > 0 ? cleaned : null
}

type SleepFn = (ms: number) => Promise<void>

async function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) return
  await new Promise<void>((resolve) => setTimeout(resolve, ms))
}

let sleepImpl: SleepFn = defaultSleep

/** Test-only: replace sleep (pass `null` to restore). */
export function setDbBootSleepForTests(fn: SleepFn | null): void {
  sleepImpl = fn ?? defaultSleep
}

export function dbBootSleep(ms: number): Promise<void> {
  return sleepImpl(ms)
}
