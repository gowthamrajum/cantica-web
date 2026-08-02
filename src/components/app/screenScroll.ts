import { createContext, useContext } from 'react'

/**
 * The active screen's scroll container, so children can drive it (scroll to top
 * on a chapter change), observe it (infinite scroll) or attach gestures to it.
 *
 * Held as STATE rather than a ref: a ref object's identity never changes, so a
 * child that mounted while the node was still null would never re-run its
 * effects once the element attached. Lives in its own module so `Screen.tsx`
 * exports components only and stays fast-refreshable.
 */
export const ScrollCtx = createContext<HTMLDivElement | null>(null)

export function useScreenScroll(): HTMLDivElement | null {
  return useContext(ScrollCtx)
}
