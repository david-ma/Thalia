/**
 * Lightweight startup phase timing for Thalia CLI / server boot.
 *
 * Set THALIA_STARTUP_TIMING=1 for per-phase log lines; a one-line summary is always printed.
 */

const startedAt = performance.now()
let lastMarkAt = startedAt

type StartupMark = {
  label: string
  elapsedMs: number
  deltaMs: number
}

const marks: StartupMark[] = []

function startupTimingVerbose(): boolean {
  return process.env.THALIA_STARTUP_TIMING === '1' || process.env.LOG_LEVEL?.toLowerCase() === 'debug'
}

/** Record a named phase boundary (elapsed since process boot and since previous mark). */
export function startupMark(label: string): void {
  const now = performance.now()
  const elapsedMs = now - startedAt
  const deltaMs = now - lastMarkAt
  lastMarkAt = now
  marks.push({ label, elapsedMs, deltaMs })

  if (startupTimingVerbose()) {
    console.debug(
      `[startup +${Math.round(elapsedMs)}ms, Δ${Math.round(deltaMs)}ms] ${label}`,
    )
  }
}

/** Print a compact summary of all recorded phases. */
export function startupSummary(): void {
  const totalMs = performance.now() - startedAt
  if (marks.length === 0) {
    console.log(`Thalia startup complete in ${Math.round(totalMs)}ms`)
    return
  }

  const phases = marks.map((m) => `${m.label}:${Math.round(m.deltaMs)}ms`).join(', ')
  console.log(`Thalia startup complete in ${Math.round(totalMs)}ms (${phases})`)
}

/** Milliseconds since the startup timer began (for request latency diagnostics). */
export function startupElapsedMs(): number {
  return performance.now() - startedAt
}

/** Reset marks — used in tests only. */
export function resetStartupTimerForTests(): void {
  marks.length = 0
}
