import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  getControlStatus,
  getSessions,
  sendControl,
  type ControlCmd,
  type SessionSummary
} from '../lib/relay'
import { useLiveState } from '../lib/useLiveState'
import { textOf } from '../lib/stage'
import { EmblemBadge } from '../components/Emblem'

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

  return (
    <div className="min-h-[100dvh] bg-[#0b1120] text-white">
      {conn ? (
        <Controller conn={conn} onDisconnect={disconnect} onBadPin={disconnect} />
      ) : (
        <Connect initialRoom={params.get('room') || ''} initialPin={params.get('pin') || ''} onConnect={connect} />
      )}
    </div>
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
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pt-[calc(env(safe-area-inset-top)+28px)] pb-10">
      <div className="mb-8 flex items-center gap-3">
        <EmblemBadge className="h-10 w-10" tone="paper" />
        <div>
          <div className="font-serif text-lg font-semibold">Service remote</div>
          <div className="text-[13px] text-white/55">Advance the live slides from your phone</div>
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
                  <span className="block truncate font-semibold">{s.label || 'Sunday Service'}</span>
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
          <div className="mb-4 font-serif text-xl font-semibold">{label || 'Live Service'}</div>

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
          <Link to="/" className="text-white/45 underline-offset-2 hover:underline">
            ← Back to the church site
          </Link>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------- controller
function Controller({
  conn,
  onDisconnect,
  onBadPin
}: {
  conn: Saved
  onDisconnect: () => void
  onBadPin: () => void
}): JSX.Element {
  const { state, connected } = useLiveState(conn.room)
  const [flash, setFlash] = useState<string | null>(null)
  const [pending, setPending] = useState<ControlCmd | null>(null)

  const liveShowing = !!state?.slide && !state.blackout && !state.clearText && !state.showLogo
  const current = textOf(state?.slide)
  const next = textOf(state?.next)
  const order = state?.order || []

  const run = useCallback(
    async (cmd: ControlCmd, arg?: number): Promise<void> => {
      setPending(cmd)
      try {
        const r = await sendControl(conn.room, conn.pin, cmd, arg)
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
      } finally {
        setPending(null)
      }
    },
    [conn.room, conn.pin, onBadPin]
  )

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2200)
    return () => clearTimeout(t)
  }, [flash])

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-[calc(env(safe-area-inset-bottom)+16px)]">
      {/* header */}
      <div className="flex items-center gap-3 pb-3">
        <span className={`h-2.5 w-2.5 flex-none rounded-full ${liveShowing ? 'animate-pulse bg-red-500' : connected ? 'bg-amber-400' : 'bg-white/30'}`} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-serif text-[17px] font-semibold">{state?.name || conn.label || 'Live Service'}</div>
          <div className="text-[11px] uppercase tracking-wider text-white/45">
            {liveShowing ? 'Live' : connected ? 'Connected' : 'Reconnecting…'}
          </div>
        </div>
        <button onClick={onDisconnect} className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70">
          Exit
        </button>
      </div>

      {/* current + next preview */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">On screen now</div>
        <div className="min-h-[3.5rem] font-serif text-lg leading-snug">
          {state?.blackout ? (
            <span className="text-white/40">Screen blacked out</span>
          ) : state?.showLogo ? (
            <span className="text-white/40">Showing logo</span>
          ) : state?.clearText ? (
            <span className="text-white/40">Text cleared</span>
          ) : current.length ? (
            current.map((l, i) => <div key={i}>{l}</div>)
          ) : (
            <span className="text-white/40">—</span>
          )}
        </div>
        {next.length > 0 && (
          <div className="mt-3 border-t border-white/10 pt-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/35">Next</span>
            <div className="mt-0.5 truncate text-sm text-white/55">{next.join(' · ')}</div>
          </div>
        )}
      </div>

      {/* prev / next */}
      <div className="mt-4 grid grid-cols-[1fr_1.7fr] gap-3">
        <button
          onClick={() => void run('prev')}
          className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] py-6 text-lg font-semibold text-white/85 transition active:scale-[0.98] disabled:opacity-50"
          disabled={pending === 'prev'}
        >
          <span className="text-2xl">‹</span> Prev
        </button>
        <button
          onClick={() => void run('next')}
          className="flex items-center justify-center gap-2 rounded-2xl bg-amber-500 py-6 text-xl font-bold text-[#1a1204] transition active:scale-[0.98] disabled:opacity-60"
          disabled={pending === 'next'}
        >
          Next <span className="text-3xl">›</span>
        </button>
      </div>

      {/* toggles */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <ToggleBtn label="Blackout" active={!!state?.blackout} onClick={() => void run('blackout')} />
        <ToggleBtn label="Clear text" active={!!state?.clearText} onClick={() => void run('clear')} />
        <ToggleBtn label="Logo" active={!!state?.showLogo} onClick={() => void run('logo')} />
      </div>

      {/* order — tap to jump */}
      {order.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">Order of service</div>
          <div className="grid gap-2">
            {order.map((it, i) => (
              <button
                key={it.title + i}
                onClick={() => void run('goto', i)}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition active:scale-[0.99] ${
                  it.live ? 'border-amber-400/60 bg-amber-400/10' : 'border-white/10 bg-white/[0.04]'
                }`}
              >
                <span className={`h-2 w-2 flex-none rounded-full ${it.live ? 'bg-amber-400' : 'bg-white/20'}`} />
                <span className="min-w-0 flex-1 truncate text-[15px] text-white/85">{it.title}</span>
                {it.kind && <span className="text-[11px] uppercase tracking-wide text-white/35">{it.kind}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {flash && (
        <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-4">
          <div className="rounded-full bg-black/80 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur">{flash}</div>
        </div>
      )}
    </div>
  )
}

function ToggleBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border py-3.5 text-sm font-semibold transition active:scale-[0.98] ${
        active ? 'border-amber-400/70 bg-amber-400/15 text-amber-200' : 'border-white/12 bg-white/[0.05] text-white/70'
      }`}
    >
      {label}
    </button>
  )
}
