import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { LiveState } from '../lib/relay'
import { fmtClock, fmtCountdown, formatLyric, isTimer, resolveBackground, textOf } from '../lib/stage'

/**
 * One confidence card for the operator remote: the current (or next) slide shown
 * as large, UPRIGHT, auto-fit text over its background. Unlike the audience Stage
 * (a 16:9 canvas that letterboxes to tiny text — or rotates 90° — on a portrait
 * phone), this fills the card in any orientation by scaling the text to the box,
 * so an operator can always read what's live and what's next at a glance.
 */
export function ConfidenceCard({ state }: { state: LiveState | null }): JSX.Element {
  const [, setTick] = useState(0)
  const slide = state?.slide
  const timer = isTimer(slide)
  // Tick a live countdown / clock while it's on the card.
  useEffect(() => {
    if (!timer) return
    const id = setInterval(() => setTick((t) => t + 1), 500)
    return () => clearInterval(id)
  }, [timer])

  const blackout = !!state?.blackout
  const hidden = !state || blackout || !!state.clearText || !!state.showLogo || !slide
  const bg = blackout ? { kind: 'css' as const, value: '#000' } : resolveBackground(slide?.background ?? state?.background)
  const theme = state?.theme
  const lines = timer
    ? [slide?.kind === 'clock' ? fmtClock() : fmtCountdown(slide?.countdownTo)]
    : textOf(slide).filter((t) => t && t.trim())
  const caption = timer ? slide?.message || '' : slide?.caption || ''

  const boxRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const fitKey = lines.join('\n')

  // Fill the card with the largest text that still fits. The block is pinned to
  // the card width and lines are allowed to wrap, so on a WIDE card (desktop /
  // landscape) each line stays whole and grows big, while on a NARROW card
  // (portrait phone) long lines wrap instead of shrinking to an unreadable size.
  // Binary-search the font size against the wrapped height. Re-fits on resize and
  // once the Telugu web font loads (fallback metrics otherwise mis-measure).
  useLayoutEffect(() => {
    const box = boxRef.current
    const txt = textRef.current
    if (!box || !txt || hidden || lines.length === 0) return
    const fit = (): void => {
      const availW = box.clientWidth * 0.92
      const availH = box.clientHeight * 0.84
      if (availW <= 0 || availH <= 0) return
      txt.style.width = `${availW}px`
      let lo = 9
      let hi = box.clientHeight * 0.6
      let best = lo
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2
        txt.style.fontSize = `${mid}px`
        if (txt.offsetHeight <= availH) {
          best = mid
          lo = mid
        } else {
          hi = mid
        }
      }
      txt.style.fontSize = `${best}px`
    }
    fit()
    if (document.fonts?.ready) void document.fonts.ready.then(fit).catch(() => {})
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    return () => ro.disconnect()
  }, [fitKey, hidden, lines.length])

  return (
    <div ref={boxRef} className="conf-card">
      {bg.kind === 'css' && <div className="conf-bg" style={{ background: bg.value }} />}
      {bg.kind === 'image' && (
        <div className="conf-bg conf-bg-media">
          <img src={bg.value} alt="" />
        </div>
      )}
      {bg.kind === 'video' && (
        <div className="conf-bg conf-bg-media">
          <video src={bg.value} autoPlay muted loop playsInline />
        </div>
      )}
      {!blackout && theme?.scrim ? <div className="conf-scrim" style={{ background: `rgba(0,0,0,${theme.scrim})` }} /> : null}

      {hidden ? (
        <div className="conf-empty">{stateLabel(state)}</div>
      ) : (
        <div className="conf-inner">
          <div
            ref={textRef}
            className={`conf-text${theme?.uppercase ? ' upper' : ''}${theme?.shadow !== false ? ' shadow' : ''}`}
            style={{ color: theme?.textColor || '#fff', textAlign: (theme?.textAlign as CSSProperties['textAlign']) || 'center' }}
          >
            {lines.map((t, i) => (
              <div key={i} className="conf-line">
                {formatLyric(t)}
              </div>
            ))}
          </div>
          {caption && (
            <div className="conf-caption" style={{ color: theme?.captionColor || '#ffd27f' }}>
              {caption}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Muted label for the non-content live states (so the operator sees WHY the
 *  card is dark, rather than a blank box). */
function stateLabel(state: LiveState | null): string {
  if (!state) return 'Connecting…'
  if (state.blackout) return 'Screen blacked out'
  if (state.showLogo) return 'Showing logo'
  if (state.clearText) return 'Text cleared'
  return '—'
}
