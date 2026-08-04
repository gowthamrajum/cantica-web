import { useEffect, useRef } from 'react'
import { RELAY_BASE, type OrderItem, type Slide } from './relay'
import type { ServiceEnvelope, ServiceItem, ServiceSlide } from './buildService'

/**
 * Broadcasting a saved service straight from this app — no desktop, no OBS.
 *
 * Until now the deck lived on the presenter computer: Cantica owned the slides,
 * published each one to the relay, and the phone Operator sent commands back for
 * Cantica to run. The relay itself holds no deck, only the last frame.
 *
 * This module lets a browser take that presenter role. It holds the deck, posts
 * the same channel-partitioned frames the desktop posts, and listens on the same
 * control channel so the phone Operator still drives it. Nothing on the audience
 * side changes — the Viewer page, the live-sessions list and the OBS overlay all
 * read exactly what they always read, because what is published is identical.
 *
 * The catch is inherent to that design: the broadcast lives as long as the page
 * does. Close it and the room goes quiet, which is why the presenter screen says
 * so and asks before you leave.
 */

/** One slide in playing order, with the item it belongs to. */
export interface DeckEntry {
  /** Index of this slide's item, which is what a `goto` command addresses. */
  item: number
  /** Position within that item, for the "2 of 6" read-out. */
  nth: number
  of: number
  title: string
  label: string
  slot?: string
  slide: Slide
}

/** A service slide as the relay carries it — the fields every viewer reads. */
const toSlide = (s: ServiceSlide): Slide => ({
  kind: s.kind === 'scripture' ? 'scripture' : 'text',
  lines: s.lines ?? [],
  caption: s.caption,
  singleLine: s.singleLine
})

/**
 * The items flattened into the one linear run the operator moves through.
 * Slides with nothing on them are dropped here rather than being skipped over
 * later — an empty slide is a blank screen nobody meant to show.
 */
export function flattenDeck(items: ServiceItem[]): DeckEntry[] {
  const out: DeckEntry[] = []
  items.forEach((it, item) => {
    const slides = (it.slides ?? []).filter((s) => (s.lines ?? []).some((l) => l && l.trim()))
    slides.forEach((s, i) => {
      out.push({
        item,
        nth: i + 1,
        of: slides.length,
        title: it.title,
        label: s.label,
        slot: it.slot,
        slide: toSlide(s)
      })
    })
  })
  return out
}

/**
 * The lyric-free outline the audience page shows under "Order" — titles only,
 * with the item currently on screen marked. Same shape the desktop publishes.
 */
export const outlineOf = (items: ServiceItem[], liveItem: number): OrderItem[] =>
  items.map((it, i) => ({ title: it.title, kind: it.kind, live: i === liveItem }))

/** A stored service's deck, if what came back really is one. */
export function readEnvelope(data: unknown): ServiceEnvelope | null {
  const e = data as ServiceEnvelope | null
  if (!e || typeof e !== 'object') return null
  if (e.format !== 'cantica-service') return null
  if (!e.service || !Array.isArray(e.service.items)) return null
  return e
}

// ---- the room and its control PIN ----

export interface LiveKeys {
  /** The room slug, which is also the secret: it is what the viewer link is. */
  room: string
  /** Four digits the Operator types on their phone. */
  pin: string
}

const keyFor = (serviceId: number): string => `tcc-live-${serviceId}`

/**
 * This service's room and PIN, minted once and then kept.
 *
 * Kept rather than regenerated because both are handed out the moment a
 * broadcast starts: the room is inside the link people are watching on, and the
 * PIN is what the Operator has already typed. A reload mid-service that changed
 * either would drop the congregation and lock the operator out.
 */
export function liveKeysFor(serviceId: number): LiveKeys {
  if (!Number.isFinite(serviceId)) return { room: '', pin: '' }
  try {
    const raw = localStorage.getItem(keyFor(serviceId))
    if (raw) {
      const saved = JSON.parse(raw) as Partial<LiveKeys>
      if (saved.room && saved.pin) return { room: saved.room, pin: saved.pin }
    }
  } catch {
    /* unreadable — mint a fresh pair below */
  }
  const keys: LiveKeys = {
    room: `ch-${Math.random().toString(36).slice(2, 8)}`,
    pin: String(Math.floor(1000 + Math.random() * 9000))
  }
  try {
    localStorage.setItem(keyFor(serviceId), JSON.stringify(keys))
  } catch {
    /* private mode — the pair still works for this page's lifetime */
  }
  return keys
}

// ---- publishing ----

/** What is on screen right now, as this app knows it. */
export interface BroadcastFrame {
  name: string
  theme?: unknown
  background?: unknown
  order?: OrderItem[]
  blackout: boolean
  clearText: boolean
  showLogo: boolean
  slide: Slide | null
  next: Slide | null
}

/**
 * Every frame goes through one chain.
 *
 * The relay keeps only the newest POST it received, so two in flight at once can
 * land out of order and leave the congregation on a slide that has already been
 * passed. Serialising costs nothing at this rate and removes the race.
 */
let chain: Promise<void> = Promise.resolve()

function post(room: string, body: unknown): Promise<boolean> {
  const run = async (): Promise<boolean> => {
    try {
      const r = await fetch(`${RELAY_BASE}/broadcast/${encodeURIComponent(room)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      return r.ok
    } catch {
      return false
    }
  }
  const sent = chain.then(run, run)
  chain = sent.then(
    () => undefined,
    () => undefined
  )
  return sent
}

/**
 * Shared fields at the top, then one slice per channel.
 *
 * The desktop can hold an item back from a channel — off-air for the stream but
 * still on the hall screen — so it sends users/stream/operator separately. This
 * app has no such per-item switch, so all three carry the same slide; the shape
 * is kept because it is what every consumer already reads.
 */
const frameOf = (f: BroadcastFrame): unknown => {
  const chan = { slide: f.slide, next: f.next }
  return {
    name: f.name,
    theme: f.theme,
    background: f.background,
    order: f.order,
    blackout: f.blackout,
    clearText: f.clearText,
    showLogo: f.showLogo,
    users: chan,
    stream: chan,
    operator: chan
  }
}

export const publishFrame = (room: string, f: BroadcastFrame): Promise<boolean> => post(room, frameOf(f))

/** A last blacked-out frame, so nobody is left staring at the slide we stopped on. */
export const publishOff = (room: string, f: BroadcastFrame): Promise<boolean> =>
  post(room, frameOf({ ...f, blackout: true, slide: null, next: null }))

// ---- taking the Operator's commands ----

export type PresenterCmd = 'next' | 'prev' | 'goto' | 'blackout' | 'clear' | 'logo' | 'end'

/**
 * Register as this room's presenter and run whatever the phone Operator sends.
 *
 * Subscribing with the PIN is what SETS it on the relay — the room's owner is
 * whoever is listening — and the relay refuses commands while nobody is, so this
 * subscription is the whole of the operator's permission to drive. EventSource
 * reconnects on its own, which is the reconnect policy.
 */
export function useRemoteCommands(
  room: string,
  pin: string,
  onCommand: (cmd: PresenterCmd, arg: number | null) => void
): void {
  // Held in a ref so a re-render — every slide change is one — doesn't tear the
  // subscription down and hand the room back with a fresh PIN registration.
  const handler = useRef(onCommand)
  useEffect(() => {
    handler.current = onCommand
  }, [onCommand])

  useEffect(() => {
    if (!room || !pin) return
    const url = `${RELAY_BASE}/broadcast/${encodeURIComponent(room)}/control/stream?pin=${encodeURIComponent(pin)}`
    const es = new EventSource(url)
    es.addEventListener('command', (e) => {
      try {
        const msg = JSON.parse((e as MessageEvent).data) as { cmd?: string; arg?: number | null }
        if (msg?.cmd) handler.current(msg.cmd as PresenterCmd, typeof msg.arg === 'number' ? msg.arg : null)
      } catch {
        /* a malformed frame is not worth killing the stream over */
      }
    })
    return () => es.close()
  }, [room, pin])
}

// ---- keeping the screen on ----

interface WakeSentinel {
  release: () => Promise<void>
}

/**
 * Hold a screen wake lock while broadcasting. The device driving the service is
 * the one thing that must not sleep, and it may be sitting untouched on a stand
 * for a whole song. Unsupported browsers simply don't get it.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeSentinel> } }
    if (!nav.wakeLock) return
    let alive = true
    let held: WakeSentinel | null = null
    const acquire = (): void => {
      nav.wakeLock
        ?.request('screen')
        .then((s) => {
          if (alive) held = s
          else void s.release().catch(() => {})
        })
        .catch(() => {})
    }
    acquire()
    // The lock is dropped whenever the tab is backgrounded; take it again on return.
    const onVisible = (): void => {
      if (!document.hidden) acquire()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      void held?.release().catch(() => {})
    }
  }, [active])
}
