import { useEffect } from 'react'
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
  // Paint the whole document black while watching, so no paper page background
  // shows through in the status-bar / home-indicator safe areas.
  useEffect(() => {
    const html = document.documentElement
    html.classList.add('channel-open')
    return () => html.classList.remove('channel-open')
  }, [])

  // Publish the REAL viewport size as CSS vars. On a portrait phone the rotor is
  // sized to the screen's height/width (it's rotated 90°), but iOS standalone
  // PWAs compute dvh/dvw unreliably and don't refresh them on rotation — leaving
  // a black strip. window.innerWidth/Height are always correct and update on
  // resize/orientationchange, so the rotor fills edge-to-edge in every case.
  useEffect(() => {
    const html = document.documentElement
    const sync = (): void => {
      html.style.setProperty('--mvw', `${window.innerWidth}px`)
      html.style.setProperty('--mvh', `${window.innerHeight}px`)
    }
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    window.visualViewport?.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
      window.visualViewport?.removeEventListener('resize', sync)
      html.style.removeProperty('--mvw')
      html.style.removeProperty('--mvh')
    }
  }, [])

  return (
    <div className="channel-root" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="channel-rotor">
        <div className="channel-frame">
          <Stage state={state} />
        </div>
        {chrome}
      </div>
    </div>
  )
}
