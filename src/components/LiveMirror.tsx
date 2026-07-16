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
