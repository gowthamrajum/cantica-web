import { useEffect, useState } from 'react'
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

  // Publish the REAL screen size as CSS vars (--mvw/--mvh); the root, rotor and
  // 16:9 frame are sized from these. On iOS the layout viewport (innerHeight /
  // dvh / a fixed inset:0 element) can be SHORTER than the physical screen — e.g.
  // 894 vs a 956px screen — leaving a black band nothing viewport-based can
  // reach. window.screen.{width,height} reports the true screen, so on touch
  // devices we take the max of it (orientation-corrected — iOS screen.* doesn't
  // swap) and the viewport. Desktop (fine pointer) just uses the window.
  useEffect(() => {
    const html = document.documentElement
    const sync = (): void => {
      // Only reach for the physical screen in the INSTALLED (standalone) PWA,
      // where the layout viewport under-reports the real screen. In a browser
      // tab innerHeight already excludes the URL bar / toolbar and IS the visible
      // area — using screen there would push the slide behind the browser chrome.
      const standalone =
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches
      const sMin = Math.min(window.screen.width, window.screen.height)
      const sMax = Math.max(window.screen.width, window.screen.height)
      const portrait = window.matchMedia('(orientation: portrait)').matches
      const fullW = standalone ? (portrait ? sMin : sMax) : 0
      const fullH = standalone ? (portrait ? sMax : sMin) : 0
      const vv = window.visualViewport
      const w = Math.max(fullW, window.innerWidth, Math.round(vv?.width || 0))
      const h = Math.max(fullH, window.innerHeight, Math.round(vv?.height || 0))
      html.style.setProperty('--mvw', `${w}px`)
      html.style.setProperty('--mvh', `${h}px`)
    }
    sync()
    // orientationchange can fire before the new dimensions settle — re-sync a beat later.
    const resync = (): void => {
      sync()
      setTimeout(sync, 150)
      setTimeout(sync, 400)
    }
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', resync)
    window.visualViewport?.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', resync)
      window.visualViewport?.removeEventListener('resize', sync)
      html.style.removeProperty('--mvw')
      html.style.removeProperty('--mvh')
    }
  }, [])

  const debug = typeof window !== 'undefined' && window.location.search.includes('debug')

  return (
    <div className="channel-root" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="channel-rotor">
        <div className="channel-frame">
          <Stage state={state} />
        </div>
        {chrome}
      </div>
      {debug && <MirrorDebug />}
    </div>
  )
}

/** Temporary on-screen readout of every viewport measurement (append ?debug to
 *  the URL). Screen-space (not inside the rotor) so it stays upright. */
function MirrorDebug(): JSX.Element {
  const [txt, setTxt] = useState('')
  useEffect(() => {
    const probe = document.createElement('div')
    probe.style.cssText =
      'position:fixed;top:0;left:0;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'
    document.body.appendChild(probe)
    const read = (): void => {
      const html = document.documentElement
      const root = document.querySelector('.channel-root')?.getBoundingClientRect()
      const rotor = document.querySelector('.channel-rotor')?.getBoundingClientRect()
      const frame = document.querySelector('.channel-frame')?.getBoundingClientRect()
      const vv = window.visualViewport
      const cs = getComputedStyle(html)
      const ps = getComputedStyle(probe)
      const R = (n?: number): number => Math.round(n || 0)
      setTxt(
        [
          `inner   ${window.innerWidth}x${window.innerHeight}`,
          `client  ${html.clientWidth}x${html.clientHeight}`,
          `screen  ${window.screen.width}x${window.screen.height}`,
          `visualV ${vv ? `${R(vv.width)}x${R(vv.height)} off${R(vv.offsetTop)} sc${vv.scale}` : 'n/a'}`,
          `root    ${root ? `${R(root.width)}x${R(root.height)} t${R(root.top)} b${R(root.bottom)}` : 'n/a'}`,
          `rotor   ${rotor ? `${R(rotor.x)},${R(rotor.y)} ${R(rotor.width)}x${R(rotor.height)}` : 'n/a'}`,
          `frame   ${frame ? `${R(frame.width)}x${R(frame.height)}` : 'n/a'}`,
          `--mvw/h ${cs.getPropertyValue('--mvw').trim()} / ${cs.getPropertyValue('--mvh').trim()}`,
          `safe    T${ps.paddingTop} R${ps.paddingRight} B${ps.paddingBottom} L${ps.paddingLeft}`,
          `dpr ${window.devicePixelRatio}  ${window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape'}`
        ].join('\n')
      )
    }
    read()
    const id = setInterval(read, 500)
    window.addEventListener('resize', read)
    window.addEventListener('orientationchange', read)
    return () => {
      clearInterval(id)
      window.removeEventListener('resize', read)
      window.removeEventListener('orientationchange', read)
      document.body.removeChild(probe)
    }
  }, [])
  return (
    <pre
      style={{
        position: 'absolute',
        top: 'max(env(safe-area-inset-top), 6px)',
        left: 'max(env(safe-area-inset-left), 6px)',
        zIndex: 100,
        margin: 0,
        padding: '6px 8px',
        background: 'rgba(0,0,0,0.72)',
        color: '#4ade80',
        font: '10px/1.35 ui-monospace, Menlo, monospace',
        borderRadius: 6,
        pointerEvents: 'none',
        whiteSpace: 'pre'
      }}
    >
      {txt}
    </pre>
  )
}
