import { useEffect, useRef, useState } from 'react'
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
  // standalone PWAs compute vw/vh/dvh unreliably and don't refresh on rotation.
  // We measure the .channel-root element itself (fixed + inset:0, so its painted
  // rect IS the true screen) via ResizeObserver.
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

  const debug = typeof window !== 'undefined' && window.location.search.includes('debug')

  return (
    <div ref={rootRef} className="channel-root" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
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
