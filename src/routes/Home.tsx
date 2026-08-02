import { Link, useNavigate } from 'react-router-dom'
import { Screen, Section } from '../components/app/Screen'
import { ListGroup, ListRow } from '../components/app/List'
import { Icon, type IconName } from '../components/app/Icons'
import { Logo, LogoBadge } from '../components/Logo'
import { CHURCH, nextGathering } from '../lib/church'
import { useSessions } from '../lib/useSessions'
import { prettyServiceName } from '../lib/format'

const TILES: { to: string; label: string; sub: string; icon: IconName; tint: string }[] = [
  { to: '/bible', label: 'Bible', sub: 'Telugu & English', icon: 'bible', tint: 'bg-navy-700' },
  { to: '/songs', label: 'Songs', sub: 'Our songbook', icon: 'songs', tint: 'bg-gold-500' },
  { to: '/give', label: 'Give', sub: '100% goes to us', icon: 'give', tint: 'bg-red-500' },
  { to: '/visit', label: 'Visit', sub: 'Plan your Sunday', icon: 'pin', tint: 'bg-emerald-600' }
]

export function Home(): JSX.Element {
  const { sessions } = useSessions()
  const navigate = useNavigate()
  const live = sessions?.filter((s) => !s.waiting) ?? []
  const waiting = sessions?.filter((s) => s.waiting) ?? []
  const next = nextGathering()

  // One live service → straight into it. Several → let the Watch tab disambiguate.
  const openLive = (): void => {
    if (live.length === 1) navigate(`/c/${encodeURIComponent(live[0].room)}`)
    else navigate('/watch')
  }

  return (
    <Screen
      title={CHURCH.name}
      hero={
        <div className="px-[var(--gutter)] pb-1 pt-1">
          <div className="app-card-dark mx-0 px-5 pb-6 pt-7">
            <div className="grain absolute inset-0 opacity-50" />
            <Lancet className="pointer-events-none absolute -right-8 -top-6 h-[150%] w-auto text-gold-300/[0.09]" />
            <div className="relative">
              <LogoBadge className="h-14 w-14" />
              <h1 className="mt-4 font-serif text-[27px] font-semibold leading-[1.12] tracking-[-0.02em]">
                {CHURCH.name}
              </h1>
              <p className="mt-1 text-[15px] text-gold-200/90">{CHURCH.nameTe}</p>
              <p className="mt-3 max-w-sm text-[14.5px] leading-relaxed text-paper/70">
                {CHURCH.tagline}. A Telugu Christian family in {CHURCH.city}.
              </p>
              <p className="mt-4 font-serif text-[17px] italic text-gold-200/85">{CHURCH.taglineTe}</p>
            </div>
          </div>
        </div>
      }
    >
      {/* On air right now — the one thing worth interrupting the layout for. */}
      {live.length > 0 && (
        <Section>
          <button type="button" onClick={openLive} className="app-card pressable flex w-full items-center gap-3.5 p-4 text-left">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-red-50">
              <span className="live-dot" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-red-600">Live now</span>
                {live[0].viewers ? <span className="text-[12px] text-ink-muted">· {live[0].viewers} watching</span> : null}
              </span>
              <span className="mt-0.5 block truncate font-serif text-[17px] font-semibold text-ink">
                {live.length === 1 ? prettyServiceName(live[0].label) : `${live.length} services on air`}
              </span>
            </span>
            <Icon name="chevron" size={18} className="flex-none text-ink-muted" />
          </button>
        </Section>
      )}

      {live.length === 0 && waiting.length > 0 && (
        <Section>
          <Link to="/watch" className="app-card pressable flex w-full items-center gap-3.5 p-4 text-left">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-gold-50">
              <span className="h-2 w-2 rounded-full bg-gold-500" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold-600">Starting soon</span>
              <span className="mt-0.5 block truncate font-serif text-[17px] font-semibold text-ink">
                {prettyServiceName(waiting[0].label)}
              </span>
            </span>
            <Icon name="chevron" size={18} className="flex-none text-ink-muted" />
          </Link>
        </Section>
      )}

      {/* Next gathering — resolved against today, so it reads "Today"/"Tomorrow". */}
      <Section>
        <div className="app-card p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-navy-700 text-gold-300">
              <Icon name="calendar" size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold-600">Next gathering</p>
              <p className="mt-0.5 font-serif text-[17px] font-semibold leading-tight text-ink">{next.service.name}</p>
              <p className="mt-0.5 text-[13.5px] text-ink-muted">
                {next.when} · {next.service.short.split(' · ')[1]} · {next.service.where.replace('In person · ', '')}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2.5">
            <Link to="/visit" className="btn-app btn-app-primary flex-1 text-[15px]">
              Plan your visit
            </Link>
            <Link to="/watch" className="btn-app btn-app-quiet flex-1 text-[15px]">
              Follow live
            </Link>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid grid-cols-2 gap-3 px-[var(--gutter)]">
          {TILES.map((t) => (
            <Link key={t.to} to={t.to} className="tile">
              <span className={`grid h-10 w-10 place-items-center rounded-xl text-white ${t.tint}`}>
                <Icon name={t.icon} size={20} strokeWidth={2} />
              </span>
              <span>
                <span className="block font-serif text-[17px] font-semibold text-ink">{t.label}</span>
                <span className="mt-0.5 block text-[13px] text-ink-muted">{t.sub}</span>
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <ListGroup label="This week">
        {CHURCH.services.map((s) => (
          <ListRow key={s.name} title={s.name} subtitle={`${s.te} · ${s.where}`} value={s.short} chevron={false} />
        ))}
      </ListGroup>

      <Section>
        <Link to="/about" className="app-card pressable block p-5">
          <div className="flex items-center gap-2.5">
            <Logo className="h-7 w-6 flex-none" />
            <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold-600">A warm welcome</p>
          </div>
          <p className="mt-3 font-serif text-[20px] font-semibold leading-snug text-ink">
            Come as you are — <span className="text-gold-600">there’s a place for you.</span>
          </p>
          <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-soft">{CHURCH.welcome}</p>
          <span className="mt-3.5 inline-flex items-center gap-1 text-[14.5px] font-semibold text-navy-700">
            About our church <Icon name="chevron" size={15} />
          </span>
        </Link>
      </Section>
    </Screen>
  )
}

/** Faint stained-glass lancet motif behind the home hero. */
function Lancet({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 200 380" className={className} fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2">
        <path d="M20 380V95C20 45 55 8 100 8s80 37 80 87v285" />
        <path d="M100 8v372" />
        <path d="M20 150h160M20 235h160M20 320h160" />
        <path d="M60 26v354M140 26v354" opacity=".6" />
        <circle cx="100" cy="70" r="26" opacity=".7" />
        <path d="M100 44v52M74 70h52" opacity=".5" />
      </g>
    </svg>
  )
}
