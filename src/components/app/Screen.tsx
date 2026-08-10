import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { Icon } from './Icons'
import { ScrollCtx } from './screenScroll'

// Scroll offsets per path, so going Back lands where you left — the single
// detail that most makes navigation feel native rather than like a page load.
const scrollMemory = new Map<string, number>()

export interface ScreenProps {
  title: string
  /** ReactNode, not string: most eyebrows carry a Telugu phrase that has to be
   *  wrapped in <Te/> so it isn't announced or indexed as English. */
  eyebrow?: ReactNode
  subtitle?: ReactNode
  /** Back affordance. `label` is the previous screen's title, iOS-style. */
  back?: { to: string; label: string }
  /** Buttons for the right end of the app bar. */
  trailing?: ReactNode
  /** Makes the compact app-bar title tappable (e.g. to reopen a picker). */
  onTitleTap?: () => void
  /** Replaces the default large-title block entirely. */
  hero?: ReactNode
  /** Renders under the app bar, above the scrolling body (e.g. a search field). */
  affix?: ReactNode
  /** 'tab' fades up (tab switch), 'push' slides in from the right (drill-down). */
  variant?: 'tab' | 'push'
  /** Content column grows past the default reading width on desktop. */
  wide?: boolean
  children?: ReactNode
}

/**
 * One screen of the app: a translucent app bar with a large title that hands off
 * to a compact one as you scroll, over its own scroll container.
 */
export function Screen({
  title,
  eyebrow,
  subtitle,
  back,
  trailing,
  onTitleTap,
  hero,
  affix,
  variant = 'tab',
  wide = false,
  children
}: ScreenProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)
  const setScroll = (el: HTMLDivElement | null): void => {
    scrollRef.current = el
    setScrollEl(el)
  }
  const barRef = useRef<HTMLElement>(null)
  // Whatever stands in for the large title — the <h1>, or a custom hero block.
  const anchorRef = useRef<HTMLElement | null>(null)
  const setAnchor = (el: HTMLElement | null): void => {
    anchorRef.current = el
  }
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()
  const navType = useNavigationType()
  const { pathname } = useLocation()

  // The compact title appears exactly when the large one passes under the bar,
  // so the handoff reads as one title moving rather than two fading.
  const sync = useCallback(() => {
    const el = scrollRef.current
    const bar = barRef.current
    if (!el || !bar) return
    const t = anchorRef.current
    setScrolled(t ? t.getBoundingClientRect().bottom <= bar.getBoundingClientRect().bottom : el.scrollTop > 6)
  }, [])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // Back navigation restores; a fresh push always starts at the top.
    el.scrollTop = navType === 'POP' ? (scrollMemory.get(pathname) ?? 0) : 0
    sync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    const onScroll = (): void => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        sync()
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scrollMemory.set(pathname, el.scrollTop)
      el.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [pathname, sync])

  const goBack = (): void => {
    // Prefer real history so the platform back gesture and this button agree;
    // fall back to the parent route when the screen was opened by deep link.
    const idx = (window.history.state as { idx?: number } | null)?.idx
    if (typeof idx === 'number' && idx > 0) navigate(-1)
    else if (back) navigate(back.to, { replace: true })
  }

  return (
    <ScrollCtx.Provider value={scrollEl}>
      <div className={`screen ${variant === 'push' ? 'enter-push' : 'enter-tab'}`}>
        <header ref={barRef} className={`appbar no-select${scrolled ? ' is-scrolled' : ''}`}>
          <div className="appbar-slot">
            {back && (
              <button type="button" onClick={goBack} className="back-btn" aria-label={`Back to ${back.label}`}>
                <Icon name="back" size={21} strokeWidth={2.2} />
                <span>{back.label}</span>
              </button>
            )}
          </div>
          {onTitleTap ? (
            <button
              type="button"
              className="appbar-title inline-flex items-center justify-center gap-1"
              onClick={onTitleTap}
              tabIndex={scrolled ? 0 : -1}
              aria-hidden={!scrolled}
            >
              {title}
              <Icon name="chevron" size={13} strokeWidth={2.4} className="rotate-90 opacity-55" />
            </button>
          ) : (
            /*
             * Not a heading. It is the large title restated in the bar once you
             * have scrolled past it — the same words twice, for the eye, at a
             * point in the DOM that comes BEFORE the <h1> it duplicates. As an
             * <h2> it made every screen open on a second-level heading and
             * report a broken outline to anything reading structure.
             */
            <span className="appbar-title" aria-hidden={!scrolled}>
              {title}
            </span>
          )}
          <div className="appbar-slot is-end">{trailing}</div>
        </header>

        {affix && <div className="appbar-affix">{affix}</div>}

        <div ref={setScroll} className={`screen-scroll${affix ? ' has-affix' : ''}`}>
          <div className={`screen-body${wide ? ' is-wide' : ''}`}>
            {hero ? (
              <div ref={setAnchor}>{hero}</div>
            ) : (
              <div className="screen-hero">
                {eyebrow && <span className="screen-eyebrow">{eyebrow}</span>}
                <h1 ref={setAnchor} className="screen-title">
                  {title}
                </h1>
                {subtitle && <p className="screen-sub">{subtitle}</p>}
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </ScrollCtx.Provider>
  )
}

/** Vertical rhythm between the stacked groups that make up a screen body. */
export function Section({ children, className = '' }: { children: ReactNode; className?: string }): JSX.Element {
  return <div className={`mt-5 ${className}`}>{children}</div>
}
