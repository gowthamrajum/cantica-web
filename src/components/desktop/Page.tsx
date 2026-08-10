import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Link, useLocation, useNavigationType } from 'react-router-dom'
import { Icon } from '../app/Icons'
import { SiteFooter } from './SiteFooter'

/** Scroll offsets per path, so Back lands where you left. */
const scrollMemory = new Map<string, number>()

/**
 * One page of the desktop version.
 *
 * Where the phone stacks a single measured column under a collapsing title,
 * this is a website: an optional full-bleed hero, then a run of full-width
 * bands that colour-block against each other, closed by the site footer. Bands
 * are the page's unit of rhythm — every one of them is edge-to-edge, and only
 * the content inside is held to a reading width.
 */
export function Page({
  title,
  hero,
  children
}: {
  /** Document title for the tab; the visible heading lives in the hero. */
  title: string
  hero?: ReactNode
  children?: ReactNode
}): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const navType = useNavigationType()
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = navType === 'POP' ? (scrollMemory.get(pathname) ?? 0) : 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    return () => {
      scrollMemory.set(pathname, el.scrollTop)
    }
  }, [pathname])

  useEffect(() => {
    document.title = title
  }, [title])

  return (
    <div className="dk-page">
      <div ref={scrollRef} className="dk-page-scroll">
        {hero}
        {children}
        <SiteFooter />
      </div>
    </div>
  )
}

export type BandTone = 'paper' | 'panel' | 'navy' | 'gold'

/**
 * A full-bleed horizontal section. `tone` is the colour block: alternating
 * paper and panel is the default rhythm, with navy reserved for the one or two
 * moments on a page that should stop the eye.
 */
export function Band({
  tone = 'paper',
  className = '',
  children
}: {
  tone?: BandTone
  className?: string
  children: ReactNode
}): JSX.Element {
  return (
    <section className={`dk-band dk-band-${tone} ${className}`}>
      {tone === 'navy' && <div className="grain pointer-events-none absolute inset-0 opacity-40" />}
      <div className="dk-wrap relative">{children}</div>
    </section>
  )
}

/**
 * A band's heading: eyebrow, large serif title, optional standfirst, and the
 * "view all"-style link that sits out on the right of the same line.
 */
export function BandHead({
  eyebrow,
  title,
  sub,
  action,
  tone = 'light'
}: {
  eyebrow?: string
  title: string
  sub?: ReactNode
  action?: { to: string; label: string }
  tone?: 'light' | 'dark'
}): JSX.Element {
  return (
    <div className={`dk-bandhead${tone === 'dark' ? ' is-dark' : ''}`}>
      <div className="min-w-0">
        {eyebrow && <span className="dk-eyebrow">{eyebrow}</span>}
        <h2 className="dk-band-title">{title}</h2>
        {sub && <p className="dk-band-sub">{sub}</p>}
      </div>
      {action && (
        <Link to={action.to} className="dk-viewall">
          {action.label} <Icon name="chevron" size={15} strokeWidth={2.4} />
        </Link>
      )}
    </div>
  )
}

/** An n-up grid of cards. Collapses to two columns, then one, as the window narrows. */
export function CardGrid({
  cols = 3,
  className = '',
  children
}: {
  cols?: 2 | 3 | 4
  className?: string
  children: ReactNode
}): JSX.Element {
  return <div className={`dk-grid dk-grid-${cols} ${className}`}>{children}</div>
}
