import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Icon, type IconName } from '../components/app/Icons'
import { InstallBanner } from '../components/app/InstallBanner'
import { Logo } from '../components/Logo'
import { CHURCH } from '../lib/church'
import { useSessions } from '../lib/useSessions'
import { useDesktopCapable, useViewPref } from '../lib/useDevice'

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
  { to: '/more', label: 'More', icon: 'more', owns: ['/services', '/give', '/visit', '/about', '/build', '/install'] }
]

function isTabActive(tab: Tab, path: string): boolean {
  if (tab.to === '/') return path === '/'
  if (path === tab.to) return true
  return (tab.owns ?? []).some((p) => path === p || path.startsWith(p))
}

/**
 * The phone version's persistent frame: a bottom tab bar wrapping the routed
 * screen.
 *
 * The bar lives outside the routed <Outlet/>, so it never re-mounts and never
 * animates when you switch tabs — the thing that separates an app shell from a
 * page that happens to have nav at the bottom.
 *
 * The `brand-rail` block and the `@media (min-width: 1024px)` rules in index.css
 * still turn this into a left rail, which is what you get if you force the
 * mobile version on a wide screen. The real desktop version is DesktopShell.
 */
export function MobileShell(): JSX.Element {
  const { pathname } = useLocation()
  const { sessions } = useSessions()
  const liveCount = sessions?.filter((s) => !s.waiting).length ?? 0
  /**
   * The way back, where the way out was.
   *
   * Switching to the phone version is one visible link in the desktop footer.
   * Switching back was a row at the foot of More — reachable, but only if you
   * knew to look there and then scrolled past everything else, which is the
   * same as not being there. A door you can only open from one side is the
   * complaint, not the layout.
   *
   * Shown ONLY when the phone version is being used by choice on a screen that
   * could do desktop. On an actual phone there is nothing to go back to, and a
   * bar offering it would be a permanent strip of nonsense.
   */
  const [pref, setView] = useViewPref()
  // Called unconditionally, then combined — `pref === 'mobile' && useX()` reads
  // fine and is a hook that stops being called the moment the preference is
  // anything else, which is the one thing a hook may never do.
  const capable = useDesktopCapable()
  const forcedOnDesktop = pref === 'mobile' && capable

  // `.app-shell` is sized from the measured screen (--mvh), not 100dvh: an
  // installed iOS PWA reports a layout viewport shorter than the physical
  // screen, which left the tab bar floating above a dead band at the bottom.
  // AppShell publishes those vars for both versions.

  return (
    <div className="app-shell">
      {forcedOnDesktop && (
        <div className="view-switch-bar">
          <span>You’re on the mobile version</span>
          <button type="button" onClick={() => setView('desktop')}>
            Switch to desktop
          </button>
        </div>
      )}
      <main className="app-main">
        <Outlet />
      </main>

      <InstallBanner />

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
