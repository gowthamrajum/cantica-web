import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getControlStatus, getSessions, sendControl, type ControlCmd, type SessionSummary } from '../lib/relay'
import { useLiveState } from '../lib/useLiveState'
import { LiveMirror } from '../components/LiveMirror'
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

// ------------------------------------------------------- operator (mirror+swipe)
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
  const { state, connected } = useLiveState(conn.room, 'operator')
  const liveShowing = !!state?.slide && !state.blackout && !state.clearText && !state.showLogo
  const [feedback, setFeedback] = useState<ControlCmd | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [hint, setHint] = useState(true)
  const startRef = useRef<{ x: number; y: number } | null>(null)

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
    setHint(false)
    // Forward (Next) = swipe left OR up; Back (Prev) = swipe right OR down. This
    // works whether the phone is held landscape or portrait (the slide rotates).
    const forward = Math.abs(dx) >= Math.abs(dy) ? dx < 0 : dy < 0
    void run(forward ? 'next' : 'prev')
  }

  useEffect(() => {
    const t = setTimeout(() => setHint(false), 6000)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2200)
    return () => clearTimeout(t)
  }, [flash])

  const exit = (): void => {
    onDisconnect()
    navigate('/watch')
  }

  const chrome = (
    <>
      <div className="channel-chrome">
        <button onClick={exit} aria-label="Exit operator" className="channel-back">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="channel-meta">
          <span className="channel-name">{prettyServiceName(state?.name || conn.label)}</span>
          <span className="channel-status">
            <span className={`channel-dot ${liveShowing ? 'is-live' : connected ? 'is-wait' : 'is-conn'}`} />
            {liveShowing ? 'Live · Operator' : connected ? 'Operator' : 'Connecting'}
          </span>
        </div>
      </div>

      {/* swipe direction flash */}
      {feedback && (
        <div className="op-flash">
          <span>{feedback === 'next' ? '›' : '‹'}</span>
        </div>
      )}

      {/* first-time swipe hint (auto-hides) */}
      {hint && (
        <div className="op-hint">
          <span>‹</span> Swipe to move slides <span>›</span>
        </div>
      )}

      {/* error toast */}
      {flash && <div className="op-toast">{flash}</div>}
    </>
  )

  return <LiveMirror state={state} chrome={chrome} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} />
}
