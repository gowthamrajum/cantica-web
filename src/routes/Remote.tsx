import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getControlStatus, getSessions, sendControl, type ControlCmd, type SessionSummary } from '../lib/relay'
import { useLiveState } from '../lib/useLiveState'
import { ConfidenceCard } from '../components/ConfidenceCard'
import { EmblemBadge } from '../components/Emblem'
import { prettyServiceName } from '../lib/format'

const STORE_KEY = 'tcc-remote'
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

  // Deep link from the desktop (?room=&pin=) connects straight away; otherwise
  // fall back to a previously saved session so a PWA refresh stays connected.
  useEffect(() => {
    const room = params.get('room') || ''
    const pin = params.get('pin') || ''
    if (room && pin) {
      void tryConnect(room, pin).then((ok) => ok && setConn({ room, pin }))
    } else {
      const s = loadSaved()
      if (s) setConn(s)
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
    <Connect initialRoom={params.get('room') || ''} initialPin={params.get('pin') || ''} onConnect={connect} />
  )
}

/** Validate a room + PIN against the relay. */
async function tryConnect(room: string, pin: string): Promise<boolean> {
  try {
    const st = await getControlStatus(room, pin)
    return st.online && st.pinOk
  } catch {
    return false
  }
}

// -------------------------------------------------------------------- connect
function Connect({
  initialRoom,
  initialPin,
  onConnect
}: {
  initialRoom: string
  initialPin: string
  onConnect: (s: Saved) => void
}): JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [room, setRoom] = useState(initialRoom)
  const [label, setLabel] = useState<string | undefined>(undefined)
  const [pin, setPin] = useState(initialPin)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    try {
      const st = await getControlStatus(room, pin)
      if (!st.online) setError('No presenter is connected to this service yet. Start broadcasting on the computer first.')
      else if (!st.pinOk) setError('That PIN didn’t match. Check the Broadcast panel on the presenter computer.')
      else onConnect({ room, pin, label })
    } catch {
      setError('Could not reach the service. Check your connection.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#0b1120] text-white">
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pt-[calc(env(safe-area-inset-top)+28px)] pb-10">
        <div className="mb-8 flex items-center gap-3">
          <EmblemBadge className="h-10 w-10" tone="paper" />
          <div>
            <div className="font-serif text-lg font-semibold">Operator</div>
            <div className="text-[13px] text-white/55">Move the live slides from your phone</div>
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

/** Wall clock with seconds — "11:03:53 AM", matching the desktop stage header. */
function clockText(): string {
  const d = new Date()
  const p = (n: number): string => (n < 10 ? `0${n}` : `${n}`)
  let h = d.getHours() % 12
  if (h === 0) h = 12
  return `${h}:${p(d.getMinutes())}:${p(d.getSeconds())} ${d.getHours() >= 12 ? 'PM' : 'AM'}`
}

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
  const [feedback, setFeedback] = useState<ControlCmd | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [, forceTick] = useState(0)
  const startRef = useRef<{ x: number; y: number } | null>(null)

  // Re-render every second so the header clock ticks.
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Paint the document dark so the site's paper background never peeks through the
  // safe-area insets while operating.
  useEffect(() => {
    document.documentElement.classList.add('channel-open')
    return () => document.documentElement.classList.remove('channel-open')
  }, [])

  const run = useCallback(
    async (cmd: ControlCmd): Promise<void> => {
      setFeedback(cmd)
      setTimeout(() => setFeedback(null), 450)
      try {
        const r = await sendControl(conn.room, conn.pin, cmd)
        if (r.status === 401) {
          setFlash('PIN no longer valid')
          setTimeout(onBadPin, 900)
        } else if (r.status === 409 || r.error === 'presenter-offline') {
          setFlash('Presenter is offline')
        } else if (!r.ok) {
          setFlash('Command failed')
        }
      } catch {
        setFlash('No connection')
      }
    },
    [conn.room, conn.pin, onBadPin]
  )

  const onTouchStart = (e: TouchEvent): void => {
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
    const onKey = (e: KeyboardEvent): void => {
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
  }, [run])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2200)
    return () => clearTimeout(t)
  }, [flash])

  const exit = (): void => {
    onDisconnect()
    navigate('/watch')
  }

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
        <div className="op2-clockwrap">
          <div className="op2-clock">{clockText()}</div>
          <div className="op2-service">{prettyServiceName(state?.name || conn.label) || 'Live service'}</div>
        </div>
        <div className="op2-badges">
          {typeof viewers === 'number' && viewers >= 0 && (
            <span className="op2-viewers">
              <EyeGlyph /> {viewers}
            </span>
          )}
          <span className={`op2-status ${status.cls}`}>{status.label}</span>
          <button onClick={exit} aria-label="Exit operator" className="op2-exit">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </header>

      <div className="op2-body">
        <section className="op2-section op2-section-current">
          <div className="op2-label">Current</div>
          <div className="op2-card">
            <ConfidenceCard state={state} />
          </div>
        </section>
        <section className="op2-section op2-section-next">
          <div className="op2-label">Next</div>
          <div className="op2-card">
            {nextState ? <ConfidenceCard state={nextState} /> : <div className="op2-end">End of service</div>}
          </div>
        </section>
      </div>

      <div className="op2-controls">
        <button onClick={() => void run('prev')} className="op2-btn op2-btn-prev">
          <span aria-hidden>‹</span> Prev
        </button>
        <button onClick={() => void run('next')} className="op2-btn op2-btn-next">
          Next <span aria-hidden>›</span>
        </button>
      </div>

      {feedback && (
        <div className="op2-flash">
          <span>{feedback === 'next' ? '›' : feedback === 'prev' ? '‹' : ''}</span>
        </div>
      )}
      {flash && <div className="op2-toast">{flash}</div>}
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
