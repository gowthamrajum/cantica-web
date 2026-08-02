import { useEffect, useState } from 'react'
import { getSessions, type SessionSummary } from './relay'

export interface SessionsState {
  /** null until the first response lands. */
  sessions: SessionSummary[] | null
  /** Relay clock at the time of that response — use it for "x minutes ago". */
  now: number
  error: boolean
}

/**
 * One shared poll of the relay's live-service list for the whole app.
 *
 * The tab bar's live dot, the Home banner and the Watch list all want this, and
 * three independent intervals would triple the traffic and let them disagree by
 * a few seconds. So the poll lives here at module scope: it starts when the
 * first subscriber mounts, stops when the last unmounts, and pauses while the
 * tab is in the background (an app in your pocket shouldn't be polling).
 */
const POLL_MS = 10_000

let state: SessionsState = { sessions: null, now: Date.now(), error: false }
let timer: ReturnType<typeof setInterval> | null = null
let inFlight = false
const subscribers = new Set<(s: SessionsState) => void>()

function publish(next: SessionsState): void {
  state = next
  for (const fn of subscribers) fn(next)
}

async function tick(): Promise<void> {
  if (inFlight || document.hidden) return
  inFlight = true
  try {
    const d = await getSessions()
    publish({ sessions: d.sessions, now: d.now, error: false })
  } catch {
    // Keep the last good list on a blip; only flag the error.
    publish({ ...state, error: true })
  } finally {
    inFlight = false
  }
}

function start(): void {
  if (timer) return
  void tick()
  timer = setInterval(() => void tick(), POLL_MS)
  document.addEventListener('visibilitychange', onVisible)
}

function stop(): void {
  if (timer) clearInterval(timer)
  timer = null
  document.removeEventListener('visibilitychange', onVisible)
}

function onVisible(): void {
  if (!document.hidden) void tick()
}

export function useSessions(): SessionsState {
  const [local, setLocal] = useState<SessionsState>(state)

  useEffect(() => {
    subscribers.add(setLocal)
    if (subscribers.size === 1) start()
    else void tick() // a late joiner gets fresh data rather than a stale snapshot
    return () => {
      subscribers.delete(setLocal)
      if (subscribers.size === 0) stop()
    }
  }, [])

  return local
}

/** True when at least one service is actually on air (not merely scheduled). */
export function hasLive(sessions: SessionSummary[] | null): boolean {
  return !!sessions?.some((s) => !s.waiting)
}
