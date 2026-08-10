import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Icon, type IconName } from '../components/app/Icons'
import { Logo } from '../components/Logo'
import { Te } from '../components/Te'
import { CHURCH } from '../lib/church'
import { useSessions } from '../lib/useSessions'
import { prettyServiceName } from '../lib/format'

interface NavItem {
  to: string
  label: string
  /** Sub-routes that keep this item lit while you're inside them. */
  owns?: string[]
}

/**
 * The desktop version's primary nav. Unlike the phone's five tabs, this names
 * real destinations rather than a "More" bucket — there is room for them, and a
 * visitor scanning a church site is looking for exactly these words.
 */
const NAV: NavItem[] = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About us' },
  { to: '/services', label: 'Service times' },
  { to: '/watch', label: 'Watch' },
  { to: '/bible', label: 'Bible' },
  { to: '/songs', label: 'Songs', owns: ['/songs/'] }
]

/** Everything that doesn't earn a top-level slot, behind the one dropdown. */
const MORE: { label: string; sub: string; icon: IconName; to?: string; href?: string }[] = [
  { label: 'Plan your visit', sub: 'Where we are, what to expect', icon: 'pin', to: '/visit' },
  { label: 'Give', sub: '100% of a gift reaches the church', icon: 'give', to: '/give' },
  { label: 'Notifications', sub: 'Hear when the service goes live', icon: 'bell', to: '/notifications' },
  { label: 'Add to your phone', sub: 'Install the app, or share it', icon: 'plus', to: '/install' },
  { label: 'Church website', sub: CHURCH.website.replace('https://', ''), icon: 'globe', href: CHURCH.website },
  { label: 'Get directions', sub: CHURCH.address, icon: 'pin', href: CHURCH.mapUrlG }
]

const TEAM: { label: string; sub: string; icon: IconName; to: string }[] = [
  { label: 'Service Builder', sub: "Pick Sunday's songs and readings", icon: 'sparkle', to: '/build' },
  { label: 'Operator remote', sub: 'Drive the live slides', icon: 'remote', to: '/remote' },
  { label: 'Send a notification', sub: 'Tell the church something', icon: 'bell', to: '/notify' }
]

function isActive(item: NavItem, path: string): boolean {
  if (item.to === '/') return path === '/'
  if (path === item.to) return true
  return (item.owns ?? []).some((p) => path === p || path.startsWith(p))
}

/**
 * The desktop version's frame: a two-row masthead over a scrolling page.
 *
 * Row one is brand · nav · calls to action. Row two is the week's gatherings,
 * which is the single question most people arrive at a church site to answer,
 * so it sits in the chrome rather than waiting somewhere down the page.
 *
 * The masthead is outside the page's scroll container, so it is pinned for free
 * and never re-mounts between routes.
 */
export function DesktopShell(): JSX.Element {
  const { pathname } = useLocation()
  const { sessions } = useSessions()
  const live = sessions?.filter((s) => !s.waiting) ?? []

  return (
    <div className="dk-shell">
      <header className="dk-mast">
        <div className="dk-mast-row dk-wrap">
          <Link to="/" className="dk-brand" aria-label={`${CHURCH.name} — home`}>
            <Logo className="h-11 w-10 flex-none" />
            <span className="dk-brand-text">
              <span className="dk-brand-name">{CHURCH.name}</span>
              <Te className="dk-brand-sub">{CHURCH.nameTe}</Te>
            </span>
          </Link>

          <nav className="dk-nav" aria-label="Primary">
            {NAV.map((item) => {
              const active = isActive(item, pathname)
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`dk-nav-link${active ? ' is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </NavLink>
              )
            })}
            <MoreMenu />
          </nav>

          <div className="dk-mast-end">
            {live.length > 0 && (
              <Link to={live.length === 1 ? `/c/${encodeURIComponent(live[0].room)}` : '/watch'} className="dk-live">
                <span className="live-dot" />
                <span>Live now</span>
                <span className="dk-live-name">{prettyServiceName(live[0].label)}</span>
              </Link>
            )}
            <Link to="/give" className="dk-btn dk-btn-quiet">
              Give
            </Link>
            <Link to="/visit" className="dk-btn dk-btn-gold">
              Plan your visit
            </Link>
          </div>
        </div>

        {/* The Hundred's team-selector strip, in church terms: the week at a
            glance, always one click from wherever you are. */}
        <div className="dk-strip">
          <div className="dk-wrap dk-strip-row">
            <span className="dk-strip-label">This week</span>
            <div className="dk-strip-items">
              {CHURCH.services.map((s) => (
                <Link key={s.name} to="/services" className="dk-strip-item">
                  <span className="dk-strip-name">{s.name}</span>
                  <span className="dk-strip-when">{s.short}</span>
                </Link>
              ))}
            </div>
            <Link to="/services" className="dk-strip-all">
              All service times <Icon name="chevron" size={14} strokeWidth={2.4} />
            </Link>
          </div>
        </div>
      </header>

      <main className="dk-main">
        <Outlet />
      </main>
    </div>
  )
}

/** The one dropdown, holding the links that don't earn a top-level slot. */
function MoreMenu(): JSX.Element {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  // Any navigation closes it — including clicking the item you're already on.
  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const owned = ['/visit', '/give', '/notifications', '/install', '/build', '/remote', '/notify']
  const active = owned.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  return (
    <div ref={wrapRef} className="dk-more">
      <button
        type="button"
        className={`dk-nav-link dk-more-btn${active ? ' is-active' : ''}${open ? ' is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        More <Icon name="chevron" size={13} strokeWidth={2.6} className="rotate-90" />
      </button>

      {open && (
        <div className="dk-menu" role="menu">
          <p className="dk-menu-label">Our church</p>
          {MORE.map((m) =>
            m.href ? (
              <a key={m.label} href={m.href} target="_blank" rel="noopener noreferrer" className="dk-menu-item" role="menuitem">
                <MenuBody {...m} external />
              </a>
            ) : (
              <Link key={m.label} to={m.to!} className="dk-menu-item" role="menuitem">
                <MenuBody {...m} />
              </Link>
            )
          )}

          <p className="dk-menu-label dk-menu-label-2">For our team</p>
          {TEAM.map((m) => (
            <Link key={m.label} to={m.to} className="dk-menu-item" role="menuitem">
              <MenuBody {...m} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function MenuBody({
  label,
  sub,
  icon,
  external = false
}: {
  label: string
  sub: string
  icon: IconName
  external?: boolean
}): JSX.Element {
  return (
    <>
      <span className="dk-menu-ico">
        <Icon name={icon} size={17} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="dk-menu-title">{label}</span>
        <span className="dk-menu-sub">{sub}</span>
      </span>
      {external && <Icon name="external" size={14} className="flex-none text-ink-muted" />}
    </>
  )
}
