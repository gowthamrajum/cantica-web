import { useEffect, useState } from 'react'
import { stateUrl, streamUrl, type LiveState, type LiveView } from './relay'

/** Subscribe to a room's live state — SSE first, short-poll fallback (mirrors the
 *  desktop obs.html audience client). `view` picks the audience ('users') or the
 *  unsuppressed operator slice. */
export function useLiveState(room: string, view: LiveView = 'users'): { state: LiveState | null; connected: boolean } {
  const [state, setState] = useState<LiveState | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!room) return
    let alive = true
    let es: EventSource | null = null
    let poll: ReturnType<typeof setInterval> | null = null
    let lastRev = -1

    const startPolling = (): void => {
      if (poll) return
      poll = setInterval(() => {
        fetch(stateUrl(room, view), { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (!alive || !d) return
            setConnected(true)
            if (d.rev !== lastRev) {
              lastRev = d.rev
              setState(d.state ?? null)
            }
          })
          .catch(() => alive && setConnected(false))
      }, 800)
    }

    const startSSE = (): void => {
      try {
        es = new EventSource(streamUrl(room, view))
        es.addEventListener('open', () => alive && setConnected(true))
        es.addEventListener('state', (e) => {
          try {
            const msg = JSON.parse((e as MessageEvent).data)
            if (alive && msg && typeof msg === 'object' && 'state' in msg) {
              setConnected(true)
              setState(msg.state ?? null)
            }
          } catch {
            /* ignore */
          }
        })
        es.onerror = () => {
          es?.close()
          es = null
          startPolling()
        }
      } catch {
        startPolling()
      }
    }

    if (typeof window !== 'undefined' && 'EventSource' in window) startSSE()
    else startPolling()

    return () => {
      alive = false
      es?.close()
      if (poll) clearInterval(poll)
    }
  }, [room, view])

  return { state, connected }
}
