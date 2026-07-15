import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CHURCH } from '../lib/church'
import { EmblemBadge } from './Emblem'

const LINKS = [
  { href: '#services', label: 'Services' },
  { href: '#give', label: 'Give' },
  { href: '#visit', label: 'Visit' }
]
const ROUTES = [
  { to: '/watch', label: 'Watch' },
  { to: '/bible', label: 'Bible' },
  { to: '/songs', label: 'Songs' }
]

export function Header(): JSX.Element {
  const [solid, setSolid] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = (): void => setSolid(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const dark = !solid && !open // light text while transparent over the hero

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        solid || open ? 'border-b border-line/80 bg-paper/90 backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <div className="container-x flex h-[68px] items-center justify-between">
        <a href="#top" className="flex items-center gap-3">
          <EmblemBadge className="h-10 w-10" tone={dark ? 'paper' : 'navy'} />
          <span className="leading-tight">
            <span className={`block font-serif text-[17px] font-semibold ${dark ? 'text-paper' : 'text-ink'}`}>Telugu Community Church</span>
            <span className={`block text-[11px] font-semibold uppercase tracking-label ${dark ? 'text-gold-200/90' : 'text-gold-600'}`}>{CHURCH.city}</span>
          </span>
        </a>

        <nav className="hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`text-[15px] font-semibold transition-colors ${dark ? 'text-paper/85 hover:text-white' : 'text-ink-soft hover:text-gold-600'}`}
            >
              {l.label}
            </a>
          ))}
          {ROUTES.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className={`text-[15px] font-semibold transition-colors ${dark ? 'text-paper/85 hover:text-white' : 'text-ink-soft hover:text-gold-600'}`}
            >
              {r.label}
            </Link>
          ))}
          <Link to="/watch" className={dark ? 'btn-ghost-light' : 'btn-gold'}>
            Follow the service
          </Link>
        </nav>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          className={`grid h-11 w-11 place-items-center rounded-full transition lg:hidden ${dark ? 'text-paper hover:bg-white/10' : 'text-ink hover:bg-ink/5'}`}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-line bg-paper lg:hidden">
          <nav className="container-x flex flex-col py-3">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="border-b border-line/60 py-3.5 text-[16px] font-semibold text-ink-soft">
                {l.label}
              </a>
            ))}
            {ROUTES.map((r) => (
              <Link key={r.to} to={r.to} onClick={() => setOpen(false)} className="border-b border-line/60 py-3.5 text-[16px] font-semibold text-ink-soft">
                {r.label}
              </Link>
            ))}
            <Link to="/watch" onClick={() => setOpen(false)} className="btn-gold mt-4">
              Follow the service
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
