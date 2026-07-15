import { Link, NavLink } from 'react-router-dom'
import { EmblemBadge } from './Emblem'

const LINKS = [
  { to: '/watch', label: 'Watch' },
  { to: '/bible', label: 'Bible' },
  { to: '/songs', label: 'Songs' }
]

/** Solid top bar shared by the interior pages (Watch / Bible / Songs). */
export function PageBar(): JSX.Element {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="container-x flex h-[68px] items-center justify-between gap-4">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <EmblemBadge className="h-10 w-10" tone="navy" />
          <span className="hidden truncate font-serif text-[17px] font-semibold text-ink sm:block">Telugu Community Church</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-full px-3.5 py-2 text-[15px] font-semibold transition sm:px-4 ${
                  isActive ? 'bg-navy-700 text-paper' : 'text-ink-soft hover:text-gold-600'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
          <Link to="/" className="ml-1 hidden text-[15px] font-semibold text-ink-muted transition hover:text-gold-600 sm:block">
            Home
          </Link>
        </nav>
      </div>
    </header>
  )
}
