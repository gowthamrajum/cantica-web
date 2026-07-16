import { useEffect, useRef } from 'react'
import type { ReactNode, TouchEvent } from 'react'
import { Stage } from './Stage'
import type { LiveState } from '../lib/relay'

/**
 * The full-screen live stage mirror — a landscape 16:9 canvas that fills the
 * screen (rotating 90° on a portrait phone). Shared by the audience Channel and
 * the Operator remote, so an operator drives exactly what the congregation sees.
 * `chrome` overlays (back button, status, swipe feedback) sit inside the rotor so
 * they rotate with the slide and stay readable.
 */
export function LiveMirror({
  state,
  chrome,
  onTouchStart,
  onTouchEnd
}: {
  state: LiveState | null
  chrome?: ReactNode
  onTouchStart?: (e: TouchEvent) => void
  onTouchEnd?: (e: TouchEvent) => void
}): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)

  // Paint the whole document black while watching, so no paper page background
  // shows through in the status-bar / home-indicator safe areas.
  useEffect(() => {
    const html = document.documentElement
    html.classList.add('channel-open')
    return () => html.classList.remove('channel-open')
  }, [])

  // Publish the REAL screen size as CSS vars (--mvw/--mvh). The rotated portrait
  // rotor and the 16:9 frame are sized from these instead of dvh/dvw — iOS
  // standalone PWAs compute vw/vh/dvh unreliably and don't refresh on rotation,
  // which left a black strip. We measure the .channel-root element itself (it's
  // fixed + inset:0, so its painted rect IS the true screen) via ResizeObserver,
  // which is the ground truth in every orientation on every device.
  useEffect(() => {
    const el = rootRef.current
    const html = document.documentElement
    const sync = (): void => {
      const r = el?.getBoundingClientRect()
      const w = Math.round(r?.width || window.innerWidth)
      const h = Math.round(r?.height || window.innerHeight)
      html.style.setProperty('--mvw', `${w}px`)
      html.style.setProperty('--mvh', `${h}px`)
    }
    sync()
    let ro: ResizeObserver | null = null
    if (el && 'ResizeObserver' in window) {
      ro = new ResizeObserver(sync)
      ro.observe(el)
    }
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    window.visualViewport?.addEventListener('resize', sync)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
      window.visualViewport?.removeEventListener('resize', sync)
      html.style.removeProperty('--mvw')
      html.style.removeProperty('--mvh')
    }
  }, [])

  return (
    <div ref={rootRef} className="channel-root" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="channel-rotor">
        <div className="channel-frame">
          <Stage state={state} />
        </div>
        {chrome}
      </div>
    </div>
  )
}
