import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Icon, type IconName } from './Icons'
import { Logo } from '../Logo'
import { CHURCH } from '../../lib/church'
import { useSessions } from '../../lib/useSessions'

interface Tab {
  to: string
  label: string
  icon: IconName
  /** Sub-routes that should keep this tab lit while you're pushed into them. */
  owns?: string[]
}

const TABS: Tab[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/watch', label: 'Watch', icon: 'watch' },
  { to: '/bible', label: 'Bible', icon: 'bible' },
  { to: '/songs', label: 'Songs', icon: 'songs', owns: ['/songs/'] },
  { to: '/more', label: 'More', icon: 'more', owns: ['/services', '/give', '/visit', '/about'] }
]

function isTabActive(tab: Tab, path: string): boolean {
  if (tab.to === '/') return path === '/'
  if (path === tab.to) return true
  return (tab.owns ?? []).some((p) => path === p || path.startsWith(p))
}

/**
 * The persistent app frame: a bottom tab bar on phones, a left rail on desktop
 * (same markup, re-laid-out in CSS), wrapping the routed screen.
 *
 * The bar lives outside the routed <Outlet/>, so it never re-mounts and never
 * animates when you switch tabs — the thing that separates an app shell from a
 * page that happens to have nav at the bottom.
 */
export function AppShell(): JSX.Element {
  const { pathname } = useLocation()
  const { sessions } = useSessions()
  const liveCount = sessions?.filter((s) => !s.waiting).length ?? 0

  return (
    <div className="app-shell">
      <main className="app-main">
        <Outlet />
      </main>

      <nav className="tabbar no-select" aria-label="Primary">
        <div className="brand-rail">
          <Logo className="h-10 w-10 flex-none" />
          <div className="min-w-0">
            <div className="line-clamp-2 font-serif text-[14.5px] font-semibold leading-[1.2] text-ink">
              {CHURCH.name}
            </div>
            <div className="truncate text-[12px] text-gold-600">{CHURCH.city}</div>
          </div>
        </div>

        {TABS.map((t) => {
          const active = isTabActive(t, pathname)
          return (
            <NavLink
              key={t.to}
              to={t.to}
              className={`tab${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="tab-ico">
                <Icon name={t.icon} size={22} active={active} />
                {t.to === '/watch' && liveCount > 0 && <span className="tab-dot" aria-hidden="true" />}
              </span>
              <span className="tab-label">{t.label}</span>
              {t.to === '/watch' && liveCount > 0 && <span className="sr-only">({liveCount} live)</span>}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
