import { Link, useNavigate } from 'react-router-dom'
import { Band, BandHead, CardGrid, Page } from '../../components/desktop/Page'
import { ExpectCard, ExploreCard, InviteBand, ServiceCard, type ExploreItem } from '../../components/desktop/Cards'
import { Icon } from '../../components/app/Icons'
import { Lancet } from '../../components/Lancet'
import { PhotoFrame } from '../../components/PhotoFrame'
import { CHURCH, nextGathering } from '../../lib/church'
import { useSessions } from '../../lib/useSessions'
import { prettyServiceName } from '../../lib/format'

/** The "find out more" grid — everywhere else the site can take you. */
const EXPLORE: ExploreItem[] = [
  { to: '/bible', label: 'The Bible', sub: 'Telugu and English, side by side — and it works with no signal.', icon: 'bible', tint: 'bg-navy-700' },
  { to: '/songs', label: 'Our songbook', sub: 'Every song we sing together, searchable in Telugu or English.', icon: 'songs', tint: 'bg-gold-500' },
  { to: '/watch', label: 'Watch live', sub: 'Follow Sunday worship from home, or from across the world.', icon: 'watch', tint: 'bg-red-500' },
  { to: '/visit', label: 'Plan your visit', sub: 'Where we are, when to arrive, and what a Sunday looks like.', icon: 'pin', tint: 'bg-emerald-600' },
  { to: '/give', label: 'Give', sub: '100% of a gift reaches the church — nothing is taken out.', icon: 'give', tint: 'bg-navy-500' },
  { to: '/notifications', label: 'Notifications', sub: 'Be told the moment a service goes live.', icon: 'bell', tint: 'bg-gold-600' },
  { to: '/install', label: 'Add to your phone', sub: 'Install the app, or share it with your group.', icon: 'plus', tint: 'bg-navy-700' },
  { to: '/about', label: 'About us', sub: 'Who we are as a family, and what we gather for.', icon: 'people', tint: 'bg-emerald-600' }
]

export function Home(): JSX.Element {
  return (
    <Page title={`${CHURCH.name} · ${CHURCH.city}`} hero={<Hero />}>
      <StatusBand />

      <Band tone="paper">
        <BandHead
          eyebrow="Every week"
          title="Three rhythms hold our week together"
          sub="In person on Sunday, online midweek. All are welcome at every one — there is nothing to sign up for and nobody you need to know first."
          action={{ to: '/services', label: 'All service times' }}
        />
        <CardGrid cols={3}>
          {CHURCH.services.map((s) => (
            <ServiceCard key={s.name} service={s} />
          ))}
        </CardGrid>
      </Band>

      <Band tone="panel">
        <div className="grid items-center gap-[clamp(32px,4vw,72px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
          <div>
            <span className="dk-eyebrow">A warm welcome</span>
            <h2 className="dk-band-title">
              Come as you are — <span className="text-gold-600">there’s a place for you.</span>
            </h2>
            <div className="dk-prose mt-6">
              {CHURCH.about.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/about" className="dk-btn dk-btn-navy">
                About our church <Icon name="chevron" size={16} strokeWidth={2.4} />
              </Link>
              <Link to="/visit" className="dk-btn dk-btn-quiet">
                Plan your visit
              </Link>
            </div>
          </div>
          <PhotoFrame tone="dark" aspect="aspect-[4/5]" caption="Sunday worship · 11 AM" />
        </div>
      </Band>

      <Band tone="paper">
        <BandHead
          eyebrow="Your first Sunday"
          title="What to expect"
          sub="If you have never been, here is the whole of it — no dress code, no pressure, and someone at the door who is glad you came."
          action={{ to: '/visit', label: 'Plan your visit' }}
        />
        <CardGrid cols={3}>
          {CHURCH.expect.map((e, i) => (
            <ExpectCard key={e.t} n={i + 1} title={e.t} body={e.d} />
          ))}
        </CardGrid>
      </Band>

      <Band tone="panel">
        <BandHead eyebrow="Find out more" title="Everything else, in one place" />
        <CardGrid cols={4}>
          {EXPLORE.map((item) => (
            <ExploreCard key={item.to} item={item} />
          ))}
        </CardGrid>
      </Band>

      <Band tone="gold">
        <InviteBand />
      </Band>
    </Page>
  )
}

/** Full-bleed navy opener: the invitation, then the two things to do about it. */
function Hero(): JSX.Element {
  return (
    <div className="dk-hero">
      <div className="grain pointer-events-none absolute inset-0 opacity-50" />
      <Lancet className="pointer-events-none absolute -top-24 right-[6%] h-[160%] w-auto text-gold-300/[0.07]" />
      <div className="dk-wrap relative">
        <div className="dk-hero-row">
          <div>
            <span className="dk-eyebrow text-gold-300">
              {CHURCH.nameTe} · {CHURCH.city}
            </span>
            <h1 className="dk-hero-title">
              A Telugu Christian family in the heart of <span className="text-gold-200">Dallas–Fort Worth.</span>
            </h1>
            <p className="dk-hero-lede">{CHURCH.welcome}</p>
            <p className="dk-hero-te">{CHURCH.taglineTe}</p>
            <div className="dk-hero-cta">
              <Link to="/visit" className="dk-btn dk-btn-gold dk-btn-lg">
                Plan your visit
              </Link>
              <Link to="/watch" className="dk-btn dk-btn-ghost-light dk-btn-lg">
                Watch live <Icon name="chevron" size={16} strokeWidth={2.4} />
              </Link>
            </div>
          </div>
          <div className="dk-hero-art">
            <PhotoFrame aspect="aspect-[4/5]" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * The slim strip under the hero: what is on right now, or what is on next.
 * The fixtures line of a sports site, in church terms.
 */
function StatusBand(): JSX.Element {
  const { sessions } = useSessions()
  const navigate = useNavigate()
  const live = sessions?.filter((s) => !s.waiting) ?? []
  const waiting = sessions?.filter((s) => s.waiting) ?? []
  const next = nextGathering()

  const openLive = (): void => {
    if (live.length === 1) navigate(`/c/${encodeURIComponent(live[0].room)}`)
    else navigate('/watch')
  }

  if (live.length > 0) {
    return (
      <Band tone="panel" className="dk-band-slim">
        <button type="button" onClick={openLive} className="dk-status is-live">
          <span className="dk-status-key">
            <span className="live-dot" />
            Live now
          </span>
          <span className="dk-status-main">
            {live.length === 1 ? prettyServiceName(live[0].label) : `${live.length} services on air`}
          </span>
          {live[0].viewers ? <span className="dk-status-meta">{live[0].viewers} watching</span> : null}
          <span className="dk-status-go">
            Join the service <Icon name="chevron" size={15} strokeWidth={2.4} />
          </span>
        </button>
      </Band>
    )
  }

  const soon = waiting.length > 0

  return (
    <Band tone="panel" className="dk-band-slim">
      <div className="dk-status">
        <span className="dk-status-key">{soon ? 'Starting soon' : 'Next gathering'}</span>
        <span className="dk-status-main">{soon ? prettyServiceName(waiting[0].label) : next.service.name}</span>
        {!soon && (
          <span className="dk-status-meta">
            {next.when} · {next.service.short.split(' · ')[1]} · {next.service.where.replace('In person · ', '')}
          </span>
        )}
        <Link to={soon ? '/watch' : '/services'} className="dk-status-go">
          {soon ? 'Follow live' : 'See all times'} <Icon name="chevron" size={15} strokeWidth={2.4} />
        </Link>
      </div>
    </Band>
  )
}
