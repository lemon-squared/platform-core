/**
 * Health and readiness logic. Pure, with no imports, so the route handlers and the tests share it.
 * Responses never carry error messages, versions, hostnames or timings: only "ok" or "fail".
 */

export type CheckState = 'ok' | 'fail' | 'timeout'

export interface ReadinessReport {
  status: 'ok' | 'fail'
  checks: { cms: CheckState; database: CheckState }
}

export class TimeoutError extends Error {
  constructor() {
    super('timeout')
    this.name = 'TimeoutError'
  }
}

/** Resolve with `work`, or reject with TimeoutError after `ms`. The timer never keeps a process alive. */
export function withTimeout<T>(work: Promise<T> | (() => Promise<T>), ms: number): Promise<T> {
  const promise = typeof work === 'function' ? Promise.resolve().then(work) : work
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError()), ms)
    ;(timer as { unref?: () => void }).unref?.()
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/** Run one check and reduce it to a state. Errors are swallowed on purpose: nothing leaks out. */
export async function runCheck(work: () => Promise<unknown>, ms: number): Promise<CheckState> {
  try {
    await withTimeout(work, ms)
    return 'ok'
  } catch (e) {
    return e instanceof TimeoutError ? 'timeout' : 'fail'
  }
}

export interface ReadinessProbes {
  /** Payload initialised (config loaded, DB adapter connected). Returns the DB ping to run next. */
  cms: () => Promise<() => Promise<unknown>>
  timeoutMs?: { cms?: number; database?: number }
}

/** CMS first, then a database ping. If the CMS cannot start, the database is not tried. */
export async function readiness(probes: ReadinessProbes): Promise<ReadinessReport> {
  let ping: (() => Promise<unknown>) | null = null
  const cms = await runCheck(async () => {
    ping = await probes.cms()
  }, probes.timeoutMs?.cms ?? 8000)
  const database: CheckState = ping
    ? await runCheck(ping, probes.timeoutMs?.database ?? 2000)
    : 'fail'
  return { status: cms === 'ok' && database === 'ok' ? 'ok' : 'fail', checks: { cms, database } }
}

/** Headers for every health and status response: never cached by a browser, CDN or proxy. */
export const NO_STORE_HEADERS: Record<string, string> = {
  'cache-control': 'no-store, no-cache, max-age=0, must-revalidate',
  'cdn-cache-control': 'no-store',
  'vercel-cdn-cache-control': 'no-store',
  'x-robots-tag': 'noindex',
}
