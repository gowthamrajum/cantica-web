import { useScreenVars } from '../lib/screenVars'
import { useDevice } from '../lib/useDevice'
import { MobileShell } from './MobileShell'
import { DesktopShell } from './DesktopShell'

/**
 * Picks the version of the app to render.
 *
 * The two shells are not one layout with breakpoints — they are different
 * chrome (bottom tab bar vs. two-row masthead), different page structure
 * (collapsing large title vs. full-bleed bands and a site footer), and for the
 * screens that have both, different components. See lib/useDevice for how the
 * choice is made and how a visitor can override it.
 *
 * Switching versions unmounts one shell and mounts the other. That is the
 * intent: dragging a window across 1024px should hand you the other version
 * whole, not a half-converted one.
 */
export function AppShell(): JSX.Element {
  // Both versions size themselves from the measured screen (--mvh). Held here
  // so the vars survive the shell swap rather than being torn down and re-added.
  useScreenVars()

  return useDevice() === 'desktop' ? <DesktopShell /> : <MobileShell />
}
