import { createContext, useContext, useEffect, useState } from 'react'

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
  const provided = useContext(ScrollCtx)
  const [found, setFound] = useState<HTMLDivElement | null>(null)

  /**
   * The context is null for the screens that need this most.
   *
   * A route renders <Screen> itself, so it sits OUTSIDE the provider its own
   * child supplies and can never read it — which is every route that asks. The
   * effect was silent: Songs' infinite scroll simply never armed, so the list
   * stopped at its first page however far you scrolled, and the Bible never
   * scrolled back to the top on a chapter change.
   *
   * Rather than restructure every screen around a render prop, the element is
   * found in the DOM. It is unambiguous — one screen is mounted at a time — and
   * looked up once per mount, which is once per route: the DOM is committed
   * before any effect runs, so the node is already there.
   */
  useEffect(() => {
    if (provided) return
    setFound(document.querySelector<HTMLDivElement>('.screen-scroll'))
  }, [provided])

  return provided ?? found
}
