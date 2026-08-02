import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen, Section } from '../components/app/Screen'
import { ListGroup, ListRow } from '../components/app/List'
import { Sheet } from '../components/app/Sheet'
import { Icon } from '../components/app/Icons'
import { Logo } from '../components/Logo'
import { CHURCH } from '../lib/church'
import { prettyServiceName } from '../lib/format'
import { useSessions } from '../lib/useSessions'
import type { SessionSummary } from '../lib/relay'

function ago(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`
}

export function Watch(): JSX.Element {
  const navigate = useNavigate()
  const { sessions, now, error } = useSessions()
  const [pick, setPick] = useState<SessionSummary | null>(null)

  const empty = sessions !== null && sessions.length === 0
  const dbg = typeof window !== 'undefined' && window.location.search.includes('debug') ? '?debug=1' : ''

  return (
    <Screen
      title="Watch"
      eyebrow="Live & on demand"
      subtitle="When we’re gathered, the service appears here — follow the songs, scripture, and message wherever you are."
    >
      {sessions === null && !error && (
        <Section>
          <div className="app-card flex items-center gap-3 p-5">
            <span className="spinner" />
            <span className="text-[15px] text-ink-muted">Checking for live services…</span>
          </div>
        </Section>
      )}

      {sessions && sessions.length > 0 && (
        <ListGroup label={sessions.length === 1 ? 'On air' : `${sessions.length} services`}>
          {sessions.map((s) => (
            <ListRow
              key={s.room}
              title={prettyServiceName(s.label)}
              subtitle={
                (s.waiting ? 'Waiting to begin · ' : 'Live · ') +
                ago(s.updatedAt, now) +
                (s.viewers ? ` · ${s.viewers} watching` : '')
              }
              onClick={() => setPick(s)}
            >
              <span className="sr-only">{s.waiting ? 'Waiting to begin' : 'Live now'}</span>
            </ListRow>
          ))}
        </ListGroup>
      )}

      {(empty || (error && sessions === null)) && (
        <>
          <Section>
            <div className="app-card-dark px-6 py-11 text-center">
              <div className="grain absolute inset-0 opacity-40" />
              <div className="relative grid place-items-center gap-3">
                <Logo className="h-14 w-14" detail={false} />
                <p className="mt-1 font-serif text-[21px] font-semibold">No service is live right now</p>
                <p className="text-[14.5px] text-paper/65">Our next live worship is {CHURCH.liveTime}.</p>
              </div>
            </div>
          </Section>

          <ListGroup label="Service times">
            {CHURCH.services.map((s) => (
              <ListRow key={s.name} title={s.name} subtitle={`${s.te} · ${s.where}`} value={s.short} chevron={false} />
            ))}
          </ListGroup>
        </>
      )}

      <p className="px-[calc(var(--gutter)+4px)] pt-5 text-[13px] leading-relaxed text-ink-muted">
        Services stream live in Telugu and update automatically — no need to refresh.
      </p>

      <Sheet open={!!pick} title="Join the service" onClose={() => setPick(null)}>
        {pick && (
          <>
            <p className="px-[var(--gutter)] pb-3 font-serif text-[17px] font-semibold text-ink">
              {prettyServiceName(pick.label)}
            </p>
            <div className="list-group">
              <button
                type="button"
                className="list-row has-ico"
                onClick={() => navigate(`/c/${encodeURIComponent(pick.room)}${dbg}`)}
              >
                <span className="list-ico bg-navy-700">
                  <Icon name="eye" size={18} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="list-title block">Viewer</span>
                  <span className="list-sub block">Follow along with the live slides</span>
                </span>
                <Icon name="chevron" size={17} className="list-chev" />
              </button>
              <button
                type="button"
                className="list-row has-ico"
                onClick={() => navigate(`/remote?room=${encodeURIComponent(pick.room)}${dbg ? '&debug=1' : ''}`)}
              >
                <span className="list-ico bg-gold-500">
                  <Icon name="remote" size={18} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="list-title block">Operator</span>
                  <span className="list-sub block">Enter the PIN and swipe to move slides</span>
                </span>
                <Icon name="chevron" size={17} className="list-chev" />
              </button>
            </div>
            <p className="px-[calc(var(--gutter)+4px)] pt-3 text-[13px] leading-relaxed text-ink-muted">
              Operator needs the control PIN shown in the Broadcast panel on the presenter computer.
            </p>
          </>
        )}
      </Sheet>
    </Screen>
  )
}
