import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { LiveState } from '../lib/relay'
import { fmtClock, fmtCountdown, formatLyric, isTimer, resolveBackground, sizeFor, textOf } from '../lib/stage'
import { Emblem } from './Emblem'

/** Full-frame audience mirror of the live service — the React port of the desktop
 *  obs.html render(). Uses container-query units so text scales with the frame. */
export function Stage({ state, standbyName = 'Telugu Community Church' }: { state: LiveState | null; standbyName?: string }): JSX.Element {
  const [, setTick] = useState(0)
  const slide = state?.slide
  const timer = isTimer(slide)

  useEffect(() => {
    if (!timer) return
    const id = setInterval(() => setTick((t) => t + 1), 500)
    return () => clearInterval(id)
  }, [timer])

  const theme = state?.theme
  const scale = theme?.fontScale || 1
  const blackout = !!state?.blackout
  const hidden = !state || blackout || state.clearText || state.showLogo || !slide
  // Branded standby only for genuine idle — not the operator's deliberate blank/logo.
  const standby = hidden && !(state && (state.blackout || state.clearText || state.showLogo))

  // Once real content has aired, a later idle means the service is in progress but
  // paused over a non-broadcastable section — so we say "resume", not "begin".
  const started = useRef(false)
  useEffect(() => {
    if (!hidden) started.current = true
  }, [hidden])
  const standbyTag = !state
    ? 'Connecting…'
    : started.current
      ? 'Service will resume shortly'
      : 'The service will begin shortly'

  const bg = blackout ? { kind: 'css' as const, value: '#000' } : resolveBackground(slide?.background ?? state?.background)

  const themeVars = {
    '--text': theme?.textColor || '#fff',
    '--accent': theme?.captionColor || '#ffd27f',
    '--scrim': String(theme?.scrim != null ? theme.scrim : 0)
  } as CSSProperties

  const composed = slide?.composed && slide.composed.length ? slide.composed : null
  const lines = timer ? [] : textOf(slide).filter((t) => t && t.trim())
  const showLines = !timer && !composed && lines.length > 0
  const qrOn = !!slide?.qr && !composed && !timer
  const caption = !composed ? slide?.caption || '' : ''

  // Single-line lyric slides keep each line on ONE line by shrinking the font to
  // fit the widest line (the sizeFor value is the ceiling), matching obs.html.
  const lyricRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = lyricRef.current
    if (!el || !showLines) return
    const base = sizeFor(lines.length, scale)
    // Measure against a FIXED container, not the lyric element itself: it's a
    // centered flex item that hugs its content, so its own width shrinks with the
    // font and the fit would never converge. The padded stage-content is stable.
    const box = el.closest('.stage-content') as HTMLElement | null
    const fit = (): void => {
      el.style.fontSize = base
      if (!slide?.singleLine) return
      const avail = (box?.clientWidth ?? 0) * 0.86 // ~stage padding + breathing room
      if (avail <= 0) return
      // Iterate: one proportional pass can undershoot (glyph metrics); shrink
      // until the widest line fits.
      for (let i = 0; i < 5; i++) {
        const content = el.scrollWidth
        if (content <= avail) break
        const cur = parseFloat(getComputedStyle(el).fontSize) || 0
        if (cur <= 0) break
        el.style.fontSize = `${cur * (avail / content)}px`
      }
    }
    fit()
    // Re-fit once the (Telugu) web font loads — measuring with the fallback font
    // otherwise under-shrinks, then the real, wider glyphs overflow.
    if (document.fonts?.ready) void document.fonts.ready.then(fit).catch(() => {})
    const ro = new ResizeObserver(fit)
    if (el.parentElement) ro.observe(el.parentElement)
    return () => ro.disconnect()
  }, [lines.join('\n'), scale, slide?.singleLine, showLines])

  return (
    <div className="stage-frame" style={themeVars}>
      {/* background */}
      {bg.kind === 'css' && <div className="stage-bg" style={{ background: bg.value }} />}
      {bg.kind === 'image' && <div className="stage-bg" style={{ background: '#000' }}><img className="stage-media" src={bg.value} alt="" /></div>}
      {bg.kind === 'video' && <div className="stage-bg" style={{ background: '#000' }}><video className="stage-media" src={bg.value} autoPlay muted loop playsInline /></div>}
      {!blackout && <div className="stage-scrim" style={{ background: `rgba(0,0,0,var(--scrim))` }} />}

      {standby ? (
        <div className="stage-standby">
          <Emblem className="stage-emblem" />
          <div className="stage-standby-name">{state?.name || standbyName}</div>
          <div className="stage-standby-tag">{standbyTag}</div>
        </div>
      ) : hidden ? (
        <div className="stage-bg" style={{ background: blackout ? '#000' : 'transparent' }} />
      ) : composed ? (
        <div className="stage-composed">
          {composed.map((l, i) => (
            <div
              key={i}
              className="cline"
              style={{
                left: `${(l.x / 960) * 100}%`,
                top: `${(l.y / 540) * 100}%`,
                fontSize: `${(l.fontSize / 540) * 100}cqh`,
                color: l.color || 'var(--text)',
                textAlign: (l.align as CSSProperties['textAlign']) || 'center'
              }}
            >
              {formatLyric(l.text)}
            </div>
          ))}
        </div>
      ) : (
        <div className={`stage-content${qrOn ? ' has-qr' : ''}`}>
          <div className="stage-text-wrap">
            {timer && (
              <div className="stage-lyrics shadow" style={{ fontSize: sizeFor(1, scale * 1.6) }}>
                <span className="line">{slide?.kind === 'clock' ? fmtClock() : fmtCountdown(slide?.countdownTo)}</span>
              </div>
            )}
            {showLines && (
              <div
                ref={lyricRef}
                className={`stage-lyrics${slide?.singleLine ? ' nowrap' : ''}${theme?.uppercase ? ' upper' : ''}${theme?.shadow !== false ? ' shadow' : ''}`}
                style={{ textAlign: (theme?.textAlign as CSSProperties['textAlign']) || 'center' }}
              >
                {lines.map((t, i) => (
                  <span key={i} className="line">{t}</span>
                ))}
              </div>
            )}
            {(caption || (timer && slide?.message)) && <div className="stage-caption">{caption || slide?.message}</div>}
          </div>
          {qrOn && <img className="stage-qr" src={slide!.qr} alt="Scan to give" />}
        </div>
      )}
    </div>
  )
}
