import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  beaconRelease,
  claimOperator,
  getControlStatus,
  getSessions,
  releaseOperator,
  sendControl,
  type ControlCmd,
  type VersePayload,
  type OperatorRole,
  type SessionSummary
} from '../lib/relay'
import { operatorId } from '../lib/operatorId'
import { useLiveState } from '../lib/useLiveState'
import { SermonVerseSheet } from '../components/app/SermonVerseSheet'
import { ConfidenceCard } from '../components/ConfidenceCard'
import { LogoBadge } from '../components/Logo'
import { prettyServiceName } from '../lib/format'
import { useScreenVars } from '../lib/screenVars'

const STORE_KEY = 'tcc-remote'
/** Well inside the relay's 40s lease, so one dropped renewal isn't a lost seat. */
const RENEW_MS = 12_000

type Saved = { room: string; pin: string; label?: string }

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as Saved) : null
  } catch {
    return null
  }
}

export function Remote(): JSX.Element {
  const [params] = useSearchParams()
  const [conn, setConn] = useState<Saved | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // Deep link from the desktop (?room=&pin=) connects straight away; otherwise
  // fall back to a previously saved session so a PWA refresh stays connected.
  useEffect(() => {
    const room = params.get('room') || ''
    const pin = params.get('pin') || ''
    if (room && pin) {
      void tryConnect(room, pin).then((r) => (r.ok ? setConn({ room, pin }) : setBusy(r.error ?? null)))
    } else {
      const s = loadSaved()
      // A saved session is only worth resuming if this phone can still drive it:
      // someone else may have taken the seat while this one was closed.
      if (s) void tryConnect(s.room, s.pin).then((r) => (r.ok ? setConn(s) : setBusy(r.error ?? null)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORE_KEY)
    setConn(null)
  }, [])

  const connect = useCallback((s: Saved) => {
    localStorage.setItem(STORE_KEY, JSON.stringify(s))
    setConn(s)
  }, [])

  return conn ? (
    <OperatorMirror conn={conn} onDisconnect={disconnect} onBadPin={disconnect} />
  ) : (
    <Connect
      initialRoom={params.get('room') || ''}
      initialPin={params.get('pin') || ''}
      initialError={busy}
      onConnect={connect}
    />
  )
}

/** How long to tell someone to wait for a lapsed lease, in plain words. */
const waitHint = (freeInMs?: number): string => {
  const s = Math.ceil((freeInMs ?? 40_000) / 1000)
  return s > 45 ? 'a minute or so' : s > 20 ? 'about half a minute' : 'a few seconds'
}

/** Being turned away is only useful if it says who to go and ask. */
const takenMessage = (claim: { role?: OperatorRole; freeInMs?: number }): string =>
  claim.role === 'presenter'
    ? 'The device that started this broadcast is operating it. Whoever has it can tap “Hand to a phone” on their live screen to pass the slides over.'
    : `Another phone is already operating this service — only one can drive the slides at a time. If theirs has gone to sleep, try again in ${waitHint(claim.freeInMs)}.`

/**
 * Validate a room + PIN, then claim the operator seat.
 *
 * The claim is part of connecting, not of the first tap: a volunteer who is
 * about to be refused should learn it here, not by pressing Next during a song
 * and finding nothing moves.
 */
async function tryConnect(room: string, pin: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const st = await getControlStatus(room, pin, operatorId())
    if (!st.online)
      return { ok: false, error: 'No presenter is connected to this service yet. Start broadcasting first.' }
    if (!st.pinOk) return { ok: false, error: 'That PIN didn’t match.' }
    const claim = await claimOperator(room, pin, operatorId(), { role: 'remote' })
    if (claim.status === 409 && claim.error === 'operator-taken')
      return { ok: false, error: takenMessage(claim) }
    if (!claim.ok) return { ok: false, error: 'Could not reach the service. Check your connection.' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not reach the service. Check your connection.' }
  }
}

// -------------------------------------------------------------------- connect
function Connect({
  initialRoom,
  initialPin,
  initialError,
  onConnect
}: {
  initialRoom: string
  initialPin: string
  /** Why an automatic reconnect was refused, e.g. the seat is taken. */
  initialError: string | null
  onConnect: (s: Saved) => void
}): JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [room, setRoom] = useState(initialRoom)
  const [label, setLabel] = useState<string | undefined>(undefined)
  const [pin, setPin] = useState(initialPin)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialError)

  useEffect(() => setError(initialError), [initialError])

  useEffect(() => {
    let alive = true
    void getSessions()
      .then((d) => alive && setSessions(d.sessions))
      .catch(() => alive && setSessions([]))
    return () => {
      alive = false
    }
  }, [])

  const submit = async (): Promise<void> => {
    if (!room || pin.length < 3) {
      setError('Enter the room and its PIN.')
      return
    }
    setBusy(true)
    setError(null)
    const r = await tryConnect(room, pin)
    if (r.ok) onConnect({ room, pin, label })
    else setError(r.error ?? 'Could not connect.')
    setBusy(false)
  }

  return (
    <div className="min-h-[100dvh] bg-[#0b1120] text-white">
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pt-[calc(env(safe-area-inset-top)+28px)] pb-10">
        <div className="mb-8 flex items-center gap-3">
          <LogoBadge className="h-11 w-11" />
          <div>
            {/* The page had no h1 at all — this line was its title in every
                sense except the one a screen reader can use. */}
            <h1 className="font-serif text-lg font-semibold">Operator</h1>
            <div className="text-[13px] text-white/55">Move the live slides from your phone — one phone at a time</div>
          </div>
        </div>

        {!room && (
          <>
            <p className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-white/45">Live services</p>
            {sessions === null && <p className="py-6 text-white/50">Checking…</p>}
            {sessions && sessions.length === 0 && (
              <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-white/60">
                Nothing is live right now. Start broadcasting on the presenter computer, then come back.
              </p>
            )}
            <div className="grid gap-3">
              {sessions?.map((s) => (
                <button
                  key={s.room}
                  onClick={() => {
                    setRoom(s.room)
                    setLabel(s.label)
                  }}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-left transition active:scale-[0.99]"
                >
                  <span className={`h-2.5 w-2.5 flex-none rounded-full ${s.waiting ? 'bg-amber-400' : 'animate-pulse bg-red-500'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{prettyServiceName(s.label)}</span>
                    <span className="block text-xs text-white/45">{s.waiting ? 'Waiting to begin' : 'Live now'}</span>
                  </span>
                  <span className="text-white/30">›</span>
                </button>
              ))}
            </div>
          </>
        )}

        {room && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
            <div className="mb-1 text-[13px] text-white/50">Connecting to</div>
            <div className="mb-4 font-serif text-xl font-semibold">{prettyServiceName(label)}</div>

            <label className="mb-1.5 block text-[13px] font-semibold text-white/60">Control PIN</label>
            <input
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="••••"
              className="w-full rounded-xl border border-white/15 bg-[#0b1120] px-4 py-3.5 text-center text-2xl font-semibold tracking-[0.4em] text-white outline-none focus:border-amber-400"
            />

            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

            <button
              onClick={() => void submit()}
              disabled={busy}
              className="mt-4 w-full rounded-xl bg-amber-500 py-3.5 font-semibold text-[#1a1204] transition active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? 'Checking…' : 'Connect'}
            </button>
            <button onClick={() => setRoom('')} className="mt-3 w-full py-2 text-sm text-white/50">
              ← Pick a different service
            </button>
          </div>
        )}

        <div className="mt-auto pt-10 text-center text-xs text-white/35">
          The PIN is shown in the <b className="text-white/50">Broadcast</b> panel on the presenter computer.
          <div className="mt-2">
            <Link to="/watch" className="text-white/45 underline-offset-2 hover:underline">
              ← Back to services
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------- operator (confidence view)
const SWIPE_MIN = 45 // px; below this a gesture is a tap, not a swipe

function OperatorMirror({
  conn,
  onDisconnect,
  onBadPin
}: {
  conn: Saved
  onDisconnect: () => void
  onBadPin: () => void
}): JSX.Element {
  const navigate = useNavigate()
  // Operators see the unsuppressed deck (every slide), unlike audience/OBS viewers.
  const { state, connected, viewers } = useLiveState(conn.room, 'operator')
  const liveShowing = !!state?.slide && !state.blackout && !state.clearText && !state.showLogo
  /**
   * Whether the sermon is the item on screen.
   *
   * The operator already receives the outline with the live item marked, so
   * this needs nothing new from the relay. Matched on the title in both
   * languages — it is the church's own section card, built from a template, and
   * the same test the desktop importer uses to find it.
   */
  const onSermon = !!state?.order?.some((it) => it.live && /sermon|వాక్యోపదేశం/i.test(it.title ?? ''))
  const [verseOpen, setVerseOpen] = useState(false)
  /** The order of service, as a drawer over the operator's controls. */
  const [orderOpen, setOrderOpen] = useState(false)
  /**
   * A passage is on the lower third and can be taken off it.
   *
   * Set when a verse is sent, cleared when it is taken off — or when the
   * service leaves the sermon, because a button that removes "the last quote"
   * is nonsense once nobody is quoting anything.
   *
   * One reference can be several verses and therefore several slides; the
   * presenter remembers them as a group, so this is one button whether the
   * operator sent John 3:16 or Romans 8:28-30.
   */
  const [quoteOnStream, setQuoteOnStream] = useState(false)
  /**
   * Whether the finger that is down has moved — i.e. is scrolling, not tapping.
   *
   * A touch that drags still delivers a click to whatever it started on, so
   * flicking the drawer to find a section jumped the service to whichever row
   * happened to be under the thumb. On a phone mid-service that is the worst
   * possible false positive: the screen changes in front of the congregation
   * and the operator did not ask for it.
   *
   * Held in a ref, not state: the click handler has to read it during the same
   * gesture, and a re-render between move and click would be both too late and
   * a re-render nobody needs while a list is being flung.
   */
  const scrolled = useRef(false)
  const touchStartY = useRef(0)
  // Only ever offered during the sermon, so leaving it closes the sheet rather
  // than leaving a way to put a verse over the next song.
  useEffect(() => {
    if (!onSermon) setVerseOpen(false)
  }, [onSermon])
  const [feedback, setFeedback] = useState<ControlCmd | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  // Ending affects everyone watching, so it is asked rather than done on a tap
  // that could just as easily have been a mis-hit going for Exit.
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [ending, setEnding] = useState(false)
  const [ended, setEnded] = useState(false)
  /** Set if the seat went to another phone while this one was away. */
  const [lostSeat, setLostSeat] = useState(false)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const me = useRef(operatorId()).current

  // The rotated root is sized from the JS-measured screen (--mvw/--mvh), not
  // from vw/vh — see useScreenVars for why iOS needs that.
  useScreenVars()

  // Paint the document dark so the site's paper background never peeks through the
  // safe-area insets while operating.
  useEffect(() => {
    document.documentElement.classList.add('channel-open')
    return () => document.documentElement.classList.remove('channel-open')
  }, [])

  /**
   * Hold the operator seat for as long as this screen is open.
   *
   * The relay's lease lapses if nobody renews it, so this heartbeat is what says
   * the phone is still here — and its refusal is how we find out somebody else
   * has taken over, which can happen after a lock screen or a dead spot has kept
   * this phone quiet long enough for the lease to run out.
   */
  useEffect(() => {
    // Once the seat has gone, stop reaching for it. Left running, this would
    // quietly take it back the moment it fell free — from the phone that now
    // holds it, or from whoever is operating the NEXT service in this room —
    // while this screen still says the turn was lost.
    if (ended || lostSeat) return
    let alive = true
    const renew = async (): Promise<void> => {
      const r = await claimOperator(conn.room, conn.pin, me, { role: 'remote' })
      if (!alive) return
      if (r.status === 409 && r.error === 'operator-taken') setLostSeat(true)
    }
    void renew()
    const id = setInterval(() => void renew(), RENEW_MS)
    // A phone that has been put away is not operating: hand the seat straight
    // back rather than making the next volunteer wait out the lease.
    const onHide = (): void => beaconRelease(conn.room, me)
    window.addEventListener('pagehide', onHide)
    return () => {
      alive = false
      clearInterval(id)
      window.removeEventListener('pagehide', onHide)
    }
  }, [conn.room, conn.pin, me, ended, lostSeat])

  const run = useCallback(
    async (cmd: ControlCmd, arg?: number | VersePayload): Promise<void> => {
      setFeedback(cmd)
      setTimeout(() => setFeedback(null), 450)
      try {
        const r = await sendControl(conn.room, conn.pin, cmd, arg, me)
        if (r.status === 401) {
          setFlash('PIN no longer valid')
          setTimeout(onBadPin, 900)
        } else if (r.error === 'not-operator') {
          setLostSeat(true)
        } else if (r.status === 409 || r.error === 'presenter-offline') {
          setFlash('Presenter is offline')
        } else if (!r.ok) {
          setFlash('Command failed')
        }
      } catch {
        setFlash('No connection')
      }
    },
    [conn.room, conn.pin, me, onBadPin]
  )

  /** The sermon card itself, over any verses put up since. */
  const jumpToSermon = useCallback(async (): Promise<void> => {
    const i = state?.order?.findIndex((o) => o.live) ?? -1
    if (i >= 0) await run('goto', i)
  }, [state, run])

  /** The section after the sermon, over the rest of them. */
  const jumpToNextSection = useCallback(async (): Promise<void> => {
    const order = state?.order ?? []
    const i = order.findIndex((o) => o.live)
    if (i >= 0 && i + 1 < order.length) await run('goto', i + 1)
  }, [state, run])

  const exit = useCallback((): void => {
    releaseOperator(conn.room, me)
    onDisconnect()
    navigate('/watch')
  }, [conn.room, me, onDisconnect, navigate])

  /**
   * Take the whole service off air.
   *
   * The command travels the same path as Next: the relay carries it and the
   * presenter — the computer, or the phone that started this from Service
   * Builder — is what actually stops publishing. So a presenter that doesn't
   * know the command leaves the broadcast up, and we say so rather than
   * claiming it ended.
   */
  const endBroadcast = useCallback(async (): Promise<void> => {
    setConfirmEnd(false)
    setEnding(true)
    try {
      const r = await sendControl(conn.room, conn.pin, 'end', undefined, me)
      if (r.status === 401) {
        setFlash('PIN no longer valid')
        return
      }
      if (r.error === 'not-operator') {
        setLostSeat(true)
        return
      }
      if (r.status === 409 || r.error === 'presenter-offline') {
        setFlash('Nothing is presenting — it’s already off air')
        return
      }
      if (r.status === 400) {
        setFlash('This service can’t be ended from the phone')
        return
      }
      if (!r.ok) {
        setFlash('Couldn’t end the broadcast')
        return
      }
      // Delivered is not the same as done. A presenter that ends stops listening
      // for commands, so the room reporting nobody online is the proof — and
      // without it we would tell the operator a service was off air while it
      // carried on in the hall.
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 500))
        const st = await getControlStatus(conn.room, conn.pin).catch(() => null)
        if (st && !st.online) {
          setEnded(true)
          setTimeout(exit, 1400)
          return
        }
      }
      setFlash('The presenter didn’t stop — it may still be on air')
    } catch {
      setFlash('No connection')
    } finally {
      setEnding(false)
    }
  }, [conn.room, conn.pin, me, exit])

  const onTouchStart = (e: TouchEvent): void => {
    // A swipe must not move slides from under the confirmation.
    if (confirmEnd || ending || ended || lostSeat) return
    const t = e.touches[0]
    startRef.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: TouchEvent): void => {
    const s = startRef.current
    startRef.current = null
    if (!s) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return
    // Forward (Next) = swipe left OR up; Back (Prev) = swipe right OR down.
    const forward = Math.abs(dx) >= Math.abs(dy) ? dx < 0 : dy < 0
    void run(forward ? 'next' : 'prev')
  }

  // Desktop: arrow / page keys and space drive the deck.
  useEffect(() => {
    if (confirmEnd || ending || ended || lostSeat) return
    const onKey = (e: KeyboardEvent): void => {
      // Not while something is being typed. Space is both "next slide" and the
      // commonest character in a reference, so without this, typing "John 3:16"
      // advanced the service — and the operator had no way to know the two were
      // the same key.
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        void run('next')
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        void run('prev')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [run, confirmEnd, ending, ended, lostSeat])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2200)
    return () => clearTimeout(t)
  }, [flash])

  // Off the sermon, there is no "last quote" to take down — and a button that
  // acts on nothing is worse than one that is missing.
  useEffect(() => {
    if (!onSermon) setQuoteOnStream(false)
  }, [onSermon])

  /**
   * How far through the service we are.
   *
   * The order has always been on the wire and nobody could see it without
   * opening the drawer — so "are we nearly at the sermon?" meant leaving the
   * controls to find out. It is two numbers and a bar; it costs nothing and it
   * answers the question every glance is really asking.
   */
  const order = state?.order ?? []
  const atIndex = order.findIndex((o) => o.live)
  const position = atIndex >= 0 && order.length ? { at: atIndex + 1, of: order.length } : null
  const progress = position ? Math.round((position.at / position.of) * 100) : 0
  const liveTitle = atIndex >= 0 ? order[atIndex]?.title : null

  /**
   * What the next slide is, in one line.
   *
   * Its caption if it has one — a scripture reference names itself better than
   * its first line does — otherwise the first line with words on it. The slide
   * carries no title of its own; the ORDER does, and that names a whole item
   * rather than the slide about to go up.
   */
  const nextLabel =
    state?.next?.caption?.trim() ||
    (state?.next?.lines ?? []).find((l) => l && l.trim())?.trim().slice(0, 80) ||
    'Next slide'

  const status = liveShowing
    ? { label: 'LIVE', cls: 'bg-red-500 text-white' }
    : connected
      ? { label: 'STANDBY', cls: 'bg-white/15 text-white/70' }
      : { label: 'OFFLINE', cls: 'bg-white/10 text-white/45' }

  // Confidence render of the next slide (with the operator's blank/logo states
  // cleared so it always previews the actual upcoming content).
  const nextState = state?.next
    ? { ...state, slide: state.next, next: null, blackout: false, clearText: false, showLogo: false }
    : null

  return (
    <div className="op2-root" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="op2-head">
        <div className="op2-headrow">
          <div className="op2-headmain">
            <h1 className="op2-service">{prettyServiceName(state?.name || conn.label) || 'Live service'}</h1>
          </div>
          <div className="op2-badges">
            {typeof viewers === 'number' && viewers >= 0 && (
              <span className="op2-viewers">
                <EyeGlyph /> {viewers}
              </span>
            )}
            <span className={`op2-status ${status.cls}`}>{status.label}</span>
            {/* The whole service, one tap away — and End now lives inside it.
                Ending happens once and was sitting a thumb-width from the
                controls pressed a hundred times. */}
            <button onClick={() => setOrderOpen(true)} className="op2-order-btn" title="Order of service">
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <button onClick={exit} aria-label="Exit operator" className="op2-exit">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Where we are, always. */}
        {position && (
          <div className="op2-progress">
            <div className="op2-progress-text">
              <span className="op2-progress-now">{liveTitle}</span>
              <span className="op2-progress-count">
                {position.at} of {position.of}
              </span>
            </div>
            <div className="op2-progress-track">
              <div className="op2-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </header>

      {/* Sliding over rather than pushing the controls aside: the operator is
          mid-service, and a layout that reflows under their thumb is how the
          wrong thing gets tapped. */}
      {orderOpen && (
        <div className="op2-drawer-wrap" role="dialog" aria-label="Order of service">
          <button className="op2-drawer-scrim" aria-label="Close" onClick={() => setOrderOpen(false)} />
          <div className="op2-drawer">
            <div className="op2-drawer-head">
              <span>Order of service</span>
              <button onClick={() => setOrderOpen(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {/* One guard for the whole list — the events bubble, so every row
                is covered by it and no row can forget. */}
            <div
              className="op2-drawer-list"
              onPointerDown={(e) => {
                scrolled.current = false
                touchStartY.current = e.clientY
              }}
              onPointerMove={(e) => {
                // A few pixels is a thumb resting, not a scroll.
                if (Math.abs(e.clientY - touchStartY.current) > 8) scrolled.current = true
              }}
              // The browser takes the gesture over once it decides this is a
              // scroll, and stops sending moves — so the cancel is the only
              // thing that says so on the platforms that do it that way.
              onPointerCancel={() => {
                scrolled.current = true
              }}
              onScroll={() => {
                scrolled.current = true
              }}
            >
              {(state?.order ?? []).map((it, i) => (
                <button
                  key={`${it.title}-${i}`}
                  className={`op2-drawer-item${it.live ? ' is-live' : ''}`}
                  onClick={() => {
                    if (scrolled.current) return
                    void run('goto', i)
                    setOrderOpen(false)
                  }}
                >
                  <span className="op2-drawer-n">{i + 1}</span>
                  <span className="op2-drawer-title">{it.title}</span>
                  {it.live && <span className="op2-drawer-now">NOW</span>}
                </button>
              ))}
              {!(state?.order ?? []).length && (
                <p className="op2-drawer-empty">The order will appear here once the service is live.</p>
              )}
            </div>
            {/* Ending is done once, by the person who knows the service is over.
                It sat in the header a thumb-width from Next; here it takes a
                deliberate trip to reach. */}
            {!ended && (
              <button
                className="op2-drawer-end"
                onClick={() => {
                  setOrderOpen(false)
                  setConfirmEnd(true)
                }}
              >
                End the broadcast
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content and controls side by side.
          This screen is ALWAYS landscape-shaped — a portrait phone is rotated
          90° into it — so it is about 390px tall and wide as a hand. Vertical
          space is the scarce thing, so the controls take a column on the right,
          where a thumb rests when the phone is held sideways, and give their
          height back to the slide. */}
      <div className="op2-mainrow">
      <div className="op2-body">
        {/* The slide on the wall, at the size it deserves. An operator glances
            up from a phone in a dark room to confirm what the congregation is
            looking at — that is the whole job of this screen, and it used to be
            one of two equal cards you had to read to tell apart. */}
        <section className="op2-now">
          <div className="op2-now-label">
            <span className="op2-now-dot" />
            On screen
          </div>
          <div className="op2-now-card">
            <ConfidenceCard state={state} />
          </div>
        </section>

        {/* Next, as one quiet line. It answers "what am I about to put up?" and
            nothing more; it is not a second thing to read. */}
        <section className="op2-upnext">
          <span className="op2-upnext-label">Next</span>
          <span className="op2-upnext-text">
            {nextState ? nextLabel : <em>End of service</em>}
          </span>
        </section>

        {/* Only once something is up there to take down. The room and the
            church's phones keep the passage — those people are reading it; this
            is the strip over the camera, and only the operator knows when it has
            stopped being what the preacher is on. */}
        {quoteOnStream && !ended && (
          <button
            className="op2-verseoff"
            onClick={() => {
              void run('verseoff')
              setQuoteOnStream(false)
            }}
          >
            Remove from live stream
            <span>The passage stays on the screens and phones</span>
          </button>
        )}
      </div>

      {/* Everything done more than once a service, in one column that never
          moves — so the target does not shift as the sermon comes and goes.
          Advancing had no button at all before this: a swipe, or an arrow key
          on a laptop. */}
      {!ended && (
        <div className="op2-bar">
          <button className="op2-bar-back" onClick={() => void run('prev')} aria-label="Previous slide">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>

          <button className="op2-bar-next" onClick={() => void run('next')}>
            Next
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* The sermon's own controls, in the one slot that changes with the
              service — a verse to put up, and the two jumps around it. */}
          {onSermon ? (
            <button className="op2-bar-verse" onClick={() => setVerseOpen(true)} aria-label="Put a verse on screen">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5h9a3 3 0 0 1 3 3v11a2 2 0 0 0-2-2H4zM20 5h-1a3 3 0 0 0-3 3v11a2 2 0 0 1 2-2h2z" />
              </svg>
              <span>Verse</span>
            </button>
          ) : (
            <span className="op2-bar-spacer" aria-hidden="true" />
          )}
        </div>
      )}
      </div>

      {/* Where the sermon goes after a verse. Both are ordinary `goto`s: it
          already means "the first slide of item N", and a verse is appended
          INSIDE the sermon item — so the sermon card is goto(live) and the next
          section is goto(live + 1), however many verses went up in between. */}
      {onSermon && !ended && (
        <div className="op2-sermon-nav">
          <button onClick={() => void jumpToSermon()}>Back to sermon</button>
          <button onClick={() => void jumpToNextSection()}>Next section</button>
        </div>
      )}

      {feedback && (
        <div className="op2-flash">
          <span>{feedback === 'next' ? '›' : feedback === 'prev' ? '‹' : ''}</span>
        </div>
      )}
      {flash && <div className="op2-toast">{flash}</div>}

      <SermonVerseSheet
        open={verseOpen}
        onClose={() => setVerseOpen(false)}
        onSend={async (payload) => {
          await run('verse', payload)
          setQuoteOnStream(true)
        }}
      />

      {/* The seat went elsewhere: stop pretending this phone still drives the
          service, and get off the deck rather than leave a dead remote in
          somebody's hand. */}
      {lostSeat && !ended && (
        <div className="op2-ask" role="dialog" aria-label="Another phone is operating">
          <p className="op2-ask-title">Another device has taken over</p>
          <p className="op2-ask-body">
            Only one device operates a service at a time, and this one lost its turn — either it was asleep or out of
            signal long enough to give the seat up, or whoever started the broadcast took it back.
          </p>
          <div className="op2-ask-row">
            <button className="op2-ask-no" onClick={exit}>
              Leave operator
            </button>
          </div>
        </div>
      )}

      {(confirmEnd || ending || ended) && (
        <div className="op2-ask" role="dialog" aria-label="End the broadcast">
          {ended ? (
            <p className="op2-ask-title">The broadcast has ended.</p>
          ) : ending ? (
            <>
              <p className="op2-ask-title">Ending…</p>
              <p className="op2-ask-body">Waiting for the presenter to go off air.</p>
            </>
          ) : (
            <>
              <p className="op2-ask-title">End the broadcast?</p>
              <p className="op2-ask-body">
                The service goes off air for everyone watching
                {typeof viewers === 'number' && viewers > 0
                  ? ` — ${viewers} ${viewers === 1 ? 'person is' : 'people are'} following right now`
                  : ''}
                . Starting it again means going back to the device that began it.
              </p>
              <div className="op2-ask-row">
                <button className="op2-ask-no" onClick={() => setConfirmEnd(false)}>
                  Keep going
                </button>
                <button className="op2-ask-yes" onClick={() => void endBroadcast()}>
                  End broadcast
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function EyeGlyph(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
