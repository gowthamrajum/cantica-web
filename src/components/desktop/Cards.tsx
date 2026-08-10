import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../app/Icons'
import { Logo } from '../Logo'
import { CHURCH, usableLinks, type ServiceTime } from '../../lib/church'

/** One gathering, as a card in a row of three. */
export function ServiceCard({ service }: { service: ServiceTime }): JSX.Element {
  const links = usableLinks(service.links)
  return (
    <article className="dk-card dk-card-service">
      <div className="flex items-start gap-4">
        <Logo className="h-14 w-12 flex-none" />
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-[21px] font-semibold leading-tight text-ink">{service.name}</h3>
          <p className="mt-1 text-[16px] font-medium text-gold-600">{service.te}</p>
        </div>
      </div>

      <dl className="mt-5 space-y-2 border-t border-line pt-4">
        <div className="flex items-baseline gap-2.5">
          <dt className="sr-only">When</dt>
          <dd className="text-[16px] font-semibold text-ink">{service.when}</dd>
        </div>
        <div>
          <dt className="sr-only">Where</dt>
          <dd className="text-[15px] text-ink-soft">{service.where}</dd>
        </div>
      </dl>
      {service.note && <p className="mt-2.5 text-[14.5px] italic text-ink-muted">{service.note}</p>}

      {links.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          {links.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className={`dk-btn flex-1 ${l.kind === 'youtube' ? 'dk-btn-gold' : 'dk-btn-quiet'}`}
            >
              {l.label} <Icon name="external" size={15} strokeWidth={2.2} />
            </a>
          ))}
        </div>
      )}
    </article>
  )
}

/** A "what to expect" value card — a numbered promise, not a link. */
export function ExpectCard({ n, title, body }: { n: number; title: string; body: string }): JSX.Element {
  return (
    <article className="dk-card dk-card-expect">
      <span className="dk-card-num">{String(n).padStart(2, '0')}</span>
      <h3 className="mt-4 font-serif text-[21px] font-semibold leading-snug text-ink">{title}</h3>
      <p className="mt-2.5 text-[15.5px] leading-relaxed text-ink-soft">{body}</p>
    </article>
  )
}

export interface ExploreItem {
  to: string
  label: string
  sub: string
  icon: IconName
  tint: string
}

/** The "find out more" grid card: an icon plate, a title, a line of copy. */
export function ExploreCard({ item }: { item: ExploreItem }): JSX.Element {
  return (
    <Link to={item.to} className="dk-card dk-card-explore">
      <span className={`dk-card-ico ${item.tint}`}>
        <Icon name={item.icon} size={22} strokeWidth={2} />
      </span>
      <h3 className="mt-4 font-serif text-[19px] font-semibold leading-snug text-ink">{item.label}</h3>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-soft">{item.sub}</p>
      <span className="dk-card-go">
        <Icon name="chevron" size={16} strokeWidth={2.4} />
      </span>
    </Link>
  )
}

/**
 * The closing band every visitor-facing page ends on: the Telugu call to
 * worship, with the two things we actually want a visitor to do.
 *
 * It sits on the warm gold band that hands off to the navy footer, so every
 * colour here is chosen against gold — a light-on-light version of this was
 * legible only to whoever already knew what it said.
 */
export function InviteBand(): JSX.Element {
  return (
    <div className="dk-invite">
      <p className="font-serif text-[clamp(26px,2.6vw,38px)] italic leading-tight text-gold-700">
        {CHURCH.taglineTe}
      </p>
      <p className="mt-3 text-[17px] text-ink-soft">
        {CHURCH.tagline} — we gather {CHURCH.liveTime.replace(' · ', ' at ')}, and there is a seat saved for you.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/visit" className="dk-btn dk-btn-navy dk-btn-lg">
          Plan your visit
        </Link>
        <Link to="/give" className="dk-btn dk-btn-quiet dk-btn-lg">
          Support the ministry <Icon name="chevron" size={16} strokeWidth={2.4} />
        </Link>
      </div>
    </div>
  )
}
