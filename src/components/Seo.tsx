import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { setRouteSeo } from '../lib/seo'

/**
 * Keeps the document head in step with the route.
 *
 * Mounted once at the top of the app, OUTSIDE the shells — the two versions
 * render the same routes from different components, and the full-screen live
 * surfaces (/c/:room, /remote, /live/:id) render outside both. One place that
 * watches the URL covers all of it, and cannot disagree with itself.
 *
 * A screen with a title it only learns at runtime overrides this with
 * lib/useSeo.
 */
export function RouteSeo(): null {
  const { pathname } = useLocation()
  useEffect(() => {
    setRouteSeo(pathname)
  }, [pathname])
  return null
}
