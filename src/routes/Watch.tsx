import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getSessions, type SessionSummary } from '../lib/relay'
import { CHURCH } from '../lib/church'
import { EmblemBadge } from '../components/Emblem'
import { Footer } from '../components/Footer'

function ago(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`
}

export function Watch(): JSX.Element {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [now, setNow] = useState(Date.now())
  const [error, setError] = useState(false)
  const [pick, setPick] = useState<SessionSummary | null>(null)

  useEffect(() => {
    let alive = true
    const tick = async (): Promise<void> => {
      try {
        const d = await getSessions()
        if (!alive) return
        setSessions(d.sessions)
        setNow(d.now)
        setError(false)
      } catch {
        if (alive) setError(true)
      }
    }
    void tick()
    const id = setInterval(() => void tick(), 8000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const empty = sessions !== null && sessions.length === 0

  return (
    <div className="flex min-h-svh flex-col">
      {/* interior top bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="container-x flex h-[68px] items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <EmblemBadge className="h-10 w-10" tone="navy" />
            <span className="font-serif text-[17px] font-semibold text-ink">Telugu Community Church</span>
          </Link>
          <Link to="/" className="text-[15px] font-semibold text-ink-soft transition hover:text-gold-600">← Home</Link>
        </div>
      </header>

      <main className="container-x flex-1 py-14 sm:py-20">
        <p className="eyebrow">Live &amp; on demand</p>
        <h1 className="mt-4 font-serif text-4xl font-semibold text-ink sm:text-5xl">Follow the service</h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft">
          When we’re gathered, the live service appears here — follow along with the songs, scripture, and message wherever you are.
        </p>

        {sessions === null && !error && <p className="py-16 text-ink-muted">Checking for live services…</p>}

        {sessions && sessions.length > 0 && (
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {sessions.map((s) => (
              <button
                key={s.room}
                onClick={() => setPick(s)}
                className="card-classic group flex min-w-0 items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <span className={`grid h-12 w-12 flex-none place-items-center rounded-full ${s.waiting ? 'bg-gold-100 text-gold-600' : 'bg-red-50 text-red-600'}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${s.waiting ? 'bg-gold-500' : 'animate-pulse bg-red-600'}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 font-serif text-lg font-semibold leading-tight text-ink">{s.label || 'Sunday Service'}</div>
                  <div className="mt-0.5 truncate text-sm text-ink-muted">
                    {(s.waiting ? 'Waiting to begin · ' : 'Live · ') + ago(s.updatedAt, now) + (s.viewers ? ` · ${s.viewers} watching` : '')}
                  </div>
                </div>
                <span className="btn-primary flex-none px-5 py-2.5 text-sm">Follow →</span>
              </button>
            ))}
          </div>
        )}

        {(empty || (error && sessions === null)) && (
          <div className="mt-10 overflow-hidden rounded-xl2 border border-line bg-card shadow-soft">
            <div className="grid place-items-center gap-3 bg-[radial-gradient(120%_120%_at_50%_0%,#22345c,#0f1728)] px-6 py-14 text-center text-paper">
              <EmblemBadge className="h-14 w-14" tone="navy" />
              <p className="mt-2 font-serif text-2xl font-semibold">No service is live right now</p>
              <p className="text-paper/70">Our next live worship is {CHURCH.liveTime}.</p>
            </div>
            <div className="grid gap-px bg-line sm:grid-cols-3">
              {CHURCH.services.map((s) => (
                <div key={s.name} className="bg-card px-5 py-5">
                  <p className="font-serif text-lg font-semibold text-ink">{s.name}</p>
                  <p className="text-sm text-gold-600">{s.te}</p>
                  <p className="mt-2 text-sm font-medium text-ink">{s.when}</p>
                  <p className="text-sm text-ink-muted">{s.where}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="mt-8 text-sm text-ink-muted">Services stream live in Telugu · updates automatically.</p>
      </main>

      <Footer />

      {pick && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => setPick(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-line bg-card p-6 pb-[calc(env(safe-area-inset-bottom)+24px)] shadow-lift sm:rounded-2xl sm:pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="eyebrow">Join the service</p>
            <h2 className="mt-3 font-serif text-2xl font-semibold text-ink">{pick.label || 'Sunday Service'}</h2>
            <p className="mt-1 text-sm text-ink-muted">How would you like to join?</p>

            <div className="mt-5 grid gap-3">
              <button
                onClick={() => navigate(`/c/${encodeURIComponent(pick.room)}`)}
                className="flex items-center gap-4 rounded-xl border border-line bg-paper p-4 text-left transition hover:border-gold-500 hover:shadow-soft"
              >
                <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-navy-700 text-paper">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-lg font-semibold text-ink">Viewer</span>
                  <span className="block text-sm text-ink-muted">Follow along with the live slides</span>
                </span>
                <span className="text-ink-muted">›</span>
              </button>

              <button
                onClick={() => navigate(`/remote?room=${encodeURIComponent(pick.room)}`)}
                className="flex items-center gap-4 rounded-xl border border-line bg-paper p-4 text-left transition hover:border-gold-500 hover:shadow-soft"
              >
                <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-gold-500 text-white">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="3" />
                    <path d="M12 6v6" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-lg font-semibold text-ink">Operator</span>
                  <span className="block text-sm text-ink-muted">Enter the PIN and swipe to move slides</span>
                </span>
                <span className="text-ink-muted">›</span>
              </button>
            </div>

            <button onClick={() => setPick(null)} className="mt-4 w-full py-2 text-sm font-semibold text-ink-muted transition hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
