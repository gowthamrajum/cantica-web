import { Link } from 'react-router-dom'
import { Icon } from '../app/Icons'
import { Logo } from '../Logo'
import { CHURCH } from '../../lib/church'
import { useViewPref } from '../../lib/useDevice'

const EXPLORE = [
  { to: '/about', label: 'About us' },
  { to: '/services', label: 'Service times' },
  { to: '/visit', label: 'Plan your visit' },
  { to: '/watch', label: 'Watch live' },
  { to: '/give', label: 'Give' }
]

const LIBRARY = [
  { to: '/bible', label: 'Bible — Telugu & English' },
  { to: '/songs', label: 'Our songbook' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/install', label: 'Add to your phone' }
]

const TEAM = [
  { to: '/build', label: 'Service Builder' },
  { to: '/remote', label: 'Operator remote' },
  { to: '/notify', label: 'Send a notification' }
]

/**
 * The site footer — the desktop version's equivalent of the phone's More tab,
 * and the thing that most makes a page read as part of a site rather than as a
 * screen. Every desktop page ends with it.
 */
export function SiteFooter(): JSX.Element {
  const [, setView] = useViewPref()

  return (
    <footer className="dk-footer">
      <div className="grain pointer-events-none absolute inset-0 opacity-40" />
      <div className="dk-wrap relative">
        <div className="dk-footer-cols">
          <div className="dk-footer-brand">
            <Logo className="h-14 w-12" />
            <p className="mt-4 font-serif text-[20px] font-semibold leading-tight text-paper">{CHURCH.name}</p>
            <p className="mt-1 text-[15px] text-gold-200/90">{CHURCH.nameTe}</p>
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-paper/60">{CHURCH.welcome}</p>
          </div>

          <FooterCol title="Explore" links={EXPLORE} />
          <FooterCol title="Read & sing" links={LIBRARY} />

          <div>
            <p className="dk-footer-title">Find us</p>
            <p className="mt-3.5 text-[14px] leading-relaxed text-paper/70">{CHURCH.address}</p>
            <p className="mt-2 text-[14px] text-gold-200/85">{CHURCH.liveTime}</p>
            <a
              href={CHURCH.mapUrlG}
              target="_blank"
              rel="noopener noreferrer"
              className="dk-footer-link mt-3.5 inline-flex items-center gap-1.5"
            >
              Get directions <Icon name="external" size={14} />
            </a>
            <a
              href={CHURCH.website}
              target="_blank"
              rel="noopener noreferrer"
              className="dk-footer-link mt-2 inline-flex items-center gap-1.5"
            >
              {CHURCH.website.replace('https://', '')} <Icon name="external" size={14} />
            </a>
          </div>
        </div>

        <div className="dk-footer-team">
          <span className="dk-footer-team-label">For our team</span>
          {TEAM.map((l) => (
            <Link key={l.to} to={l.to} className="dk-footer-link">
              {l.label}
            </Link>
          ))}
        </div>

        <div className="dk-footer-base">
          <p className="text-[13px] text-paper/50">
            © {new Date().getFullYear()} {CHURCH.name} · {CHURCH.city}
          </p>
          <div className="flex items-center gap-4">
            <p className="text-[13px] italic text-paper/45">Made with care for our church family.</p>
            {/* The way back to the phone version on a desktop browser — a site
                that offers one version and no way out is the thing people
                complain about, not the layout. */}
            <button type="button" className="dk-footer-link" onClick={() => setView('mobile')}>
              Mobile version
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }): JSX.Element {
  return (
    <div>
      <p className="dk-footer-title">{title}</p>
      <ul className="mt-3.5 space-y-2.5">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="dk-footer-link">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
