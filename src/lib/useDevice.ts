import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

/**
 * Which of the two versions of the app is on screen.
 *
 * The app ships a phone version and a desktop version — not one layout that
 * stretches. They are different shells (bottom tab bar vs. masthead), different
 * page chrome (collapsing large title vs. site header + footer), and for the
 * screens that have both, different components. This module is the one place
 * that decides which you get.
 */
export type Device = 'mobile' | 'desktop'

/** What the user asked for, if anything. 'auto' lets the viewport decide. */
export type ViewPref = 'auto' | Device

const PREF_KEY = 'tcc-view'

/**
 * Desktop needs room AND a real pointer. Width alone would hand the masthead to
 * an iPad held sideways, where hover-only affordances are dead ends; `hover`
 * alone would hand it to a 700px-wide laptop window, where six nav items and a
 * three-column layout have nowhere to go.
 */
export const DESKTOP_QUERY = '(min-width: 1024px) and (hover: hover)'

/**
 * The Capacitor iOS/Android build is a phone app whatever the screen reports —
 * a tablet in landscape clears the query above, and we still don't want a
 * website masthead inside a native app. Read off the global the native runtime
 * injects rather than importing @capacitor/core, which would pull the bridge
 * into the web bundle for one boolean.
 */
function isNativeApp(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return cap?.isNativePlatform?.() === true
}

function readPref(): ViewPref {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    return raw === '"mobile"' || raw === '"desktop"' ? (JSON.parse(raw) as Device) : 'auto'
  } catch {
    return 'auto'
  }
}

// --- media-query store, shared by every caller so there is one listener -------

let mql: MediaQueryList | null = null
function query(): MediaQueryList {
  mql ??= window.matchMedia(DESKTOP_QUERY)
  return mql
}

function subscribe(onChange: () => void): () => void {
  const m = query()
  m.addEventListener('change', onChange)
  // A forced version is stored in localStorage, which fires `storage` in other
  // tabs and nothing at all in this one — so the setter below dispatches this.
  window.addEventListener('tcc-view-change', onChange)
  window.addEventListener('storage', onChange)
  return () => {
    m.removeEventListener('change', onChange)
    window.removeEventListener('tcc-view-change', onChange)
    window.removeEventListener('storage', onChange)
  }
}

function snapshot(): Device {
  if (isNativeApp()) return 'mobile'
  const pref = readPref()
  if (pref !== 'auto') return pref
  return query().matches ? 'desktop' : 'mobile'
}

/**
 * The version to render. Re-renders the whole tree when it flips, which is
 * intended: dragging a window past 1024px should swap shells, not leave you in
 * a half-converted layout.
 */
export function useDevice(): Device {
  return useSyncExternalStore(subscribe, snapshot, () => 'mobile' as const)
}

/** True on the desktop version. Reads better than `=== 'desktop'` at call sites. */
export function useIsDesktop(): boolean {
  return useDevice() === 'desktop'
}

/**
 * Whether this screen could show the desktop version at all, ignoring any
 * forced preference. The phone version uses it to decide whether offering a
 * "Desktop version" switch would make sense — on an actual phone it never does.
 */
export function useDesktopCapable(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !isNativeApp() && query().matches,
    () => false
  )
}

/**
 * The "view desktop site / view mobile site" control. Returns the stored
 * preference (not the resolved device) plus a setter that takes effect at once.
 */
export function useViewPref(): [ViewPref, (next: ViewPref) => void] {
  const [pref, setPref] = useState<ViewPref>(readPref)

  useEffect(() => {
    const sync = (): void => setPref(readPref())
    window.addEventListener('tcc-view-change', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('tcc-view-change', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const set = useCallback((next: ViewPref) => {
    try {
      if (next === 'auto') localStorage.removeItem(PREF_KEY)
      else localStorage.setItem(PREF_KEY, JSON.stringify(next))
    } catch {
      /* private mode — the choice just won't outlive the session */
    }
    window.dispatchEvent(new Event('tcc-view-change'))
  }, [])

  return [pref, set]
}
