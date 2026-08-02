import { useEffect } from 'react'

/**
 * Publish the REAL screen size as CSS vars (--mvw/--mvh) for as long as the
 * calling view is mounted. Full-screen rotated views size themselves from these
 * rather than from vw/vh/dvh.
 *
 * On iOS the layout viewport (innerHeight / dvh / a fixed inset:0 element) can be
 * SHORTER than the physical screen — e.g. 894 vs a 956px screen — leaving a black
 * band nothing viewport-based can reach. window.screen.{width,height} reports the
 * true screen, so on touch devices we take the max of it (orientation-corrected —
 * iOS screen.* doesn't swap) and the viewport. Desktop just uses the window.
 *
 * Used by the audience mirror (LiveMirror) and the operator confidence view.
 */
export function useScreenVars(): void {
  useEffect(() => {
    const html = document.documentElement
    const sync = (): void => {
      // Only reach for the physical screen in the INSTALLED (standalone) PWA,
      // where the layout viewport under-reports the real screen. In a browser
      // tab innerHeight already excludes the URL bar / toolbar and IS the visible
      // area — using screen there would push content behind the browser chrome.
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
}
