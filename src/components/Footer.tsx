import { Link } from 'react-router-dom'
import { CHURCH } from '../lib/church'
import { EmblemBadge } from './Emblem'

const ANCHORS = [
  { href: '/#services', label: 'Services' },
  { href: '/#give', label: 'Give' },
  { href: '/#visit', label: 'Visit' }
]
const ROUTES = [
  { to: '/watch', label: 'Follow the service' },
  { to: '/bible', label: 'Bible' },
  { to: '/songs', label: 'Songs' }
]

export function Footer(): JSX.Element {
  return (
    <footer className="bg-navy-900 text-paper/80">
      <div className="container-x grid gap-10 py-16 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3">
            <EmblemBadge className="h-11 w-11" tone="navy" />
            <div>
              <p className="font-serif text-lg font-semibold text-paper">{CHURCH.name}</p>
              <p className="text-sm text-gold-200/80">{CHURCH.nameTe}</p>
            </div>
          </div>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-paper/70">{CHURCH.tagline}. A Telugu Christian family in {CHURCH.city}.</p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-label text-gold-300">Explore</p>
          <ul className="mt-4 space-y-2.5 text-[15px]">
            {ROUTES.map((n) => (
              <li key={n.to}><Link to={n.to} className="text-paper/75 transition hover:text-gold-200">{n.label}</Link></li>
            ))}
            {ANCHORS.map((n) => (
              <li key={n.href}><a href={n.href} className="text-paper/75 transition hover:text-gold-200">{n.label}</a></li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-label text-gold-300">Visit</p>
          <address className="mt-4 space-y-2.5 text-[15px] not-italic text-paper/75">
            <p>{CHURCH.address}</p>
            <p>{CHURCH.liveTime}</p>
            <p><a href={CHURCH.website} target="_blank" rel="noopener" className="transition hover:text-gold-200">{CHURCH.website.replace('https://', '')}</a></p>
          </address>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-6 text-[13px] text-paper/50 sm:flex-row">
          <p>© {CHURCH.name}. All are welcome.</p>
          <p>Made with care for our church family.</p>
        </div>
      </div>
    </footer>
  )
}
