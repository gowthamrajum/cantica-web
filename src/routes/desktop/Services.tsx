import { Link } from 'react-router-dom'
import { Band, BandHead, CardGrid, Page } from '../../components/desktop/Page'
import { ExploreCard, InviteBand, type ExploreItem } from '../../components/desktop/Cards'
import { Icon } from '../../components/app/Icons'
import { Logo } from '../../components/Logo'
import { CHURCH, usableLinks } from '../../lib/church'

/** The three ways to be at a service without being in the room. */
const FROM_HOME: ExploreItem[] = [
  {
    to: '/watch',
    label: 'Watch live',
    sub: 'The service as it happens, with the slides on your own screen.',
    icon: 'watch',
    tint: 'bg-red-500'
  },
  {
    to: '/notifications',
    label: 'Get told when it starts',
    sub: 'A notification the moment we go on air — nothing else, ever.',
    icon: 'bell',
    tint: 'bg-gold-500'
  },
  {
    to: '/songs',
    label: 'Sing along',
    sub: 'Every song we sing, in Telugu and English, wherever you are.',
    icon: 'songs',
    tint: 'bg-navy-700'
  }
]

export function Services(): JSX.Element {
  return (
    <Page
      title={`Service times · ${CHURCH.name}`}
      hero={
        <div className="dk-hero dk-hero-light">
          <div className="dk-wrap">
            <div className="dk-hero-row is-single">
              <div>
                <span className="dk-eyebrow">Gather with us</span>
                <h1 className="dk-hero-title">Service times</h1>
                <p className="dk-hero-lede">
                  Three rhythms hold our week together — in person on Sunday, and online midweek. All are welcome at
                  every one.
                </p>
                <div className="dk-hero-cta">
                  <Link to="/visit" className="dk-btn dk-btn-gold dk-btn-lg">
                    Plan your visit
                  </Link>
                  <Link to="/watch" className="dk-btn dk-btn-quiet dk-btn-lg">
                    Follow live <Icon name="chevron" size={16} strokeWidth={2.4} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      {/* The week as a table — the one view that answers "when" at a glance. */}
      <Band tone="paper">
        <div className="dk-times">
          {CHURCH.services.map((s) => {
            const links = usableLinks(s.links)
            return (
              <article key={s.name} className="dk-time-row">
                <Logo className="h-16 w-14 flex-none" />
                <div className="dk-time-name">
                  <h2 className="font-serif text-[24px] font-semibold leading-tight text-ink">{s.name}</h2>
                  <p className="mt-1 text-[16px] font-medium text-gold-600">{s.te}</p>
                  {s.note && <p className="mt-2 text-[14.5px] italic text-ink-muted">{s.note}</p>}
                </div>
                <div className="dk-time-when">
                  <p className="text-[19px] font-semibold text-ink">{s.when}</p>
                  <p className="mt-1 text-[15px] text-ink-soft">{s.where}</p>
                </div>
                <div className="dk-time-act">
                  {links.length > 0 ? (
                    links.map((l) => (
                      <a
                        key={l.url}
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className={`dk-btn ${l.kind === 'youtube' ? 'dk-btn-gold' : 'dk-btn-quiet'}`}
                      >
                        {l.label} <Icon name="external" size={15} strokeWidth={2.2} />
                      </a>
                    ))
                  ) : (
                    <Link to="/visit" className="dk-btn dk-btn-quiet">
                      Plan your visit
                    </Link>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </Band>

      {/* Not the three services again — the table above already has them. This
          band answers the question the table leaves open: what if I can't come? */}
      <Band tone="panel">
        <BandHead
          eyebrow="From anywhere"
          title="Can’t be there in person?"
          sub="Every Sunday service streams live in Telugu — with the songs, scripture, and message following along on your screen, at home or across the world."
          action={{ to: '/watch', label: 'Follow the service' }}
        />
        <CardGrid cols={3}>
          {FROM_HOME.map((item) => (
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
