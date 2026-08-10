import { useEffect } from 'react'
import { setScreenSeo, type SeoMeta } from './seo'

/**
 * A screen that only knows its own title once data has arrived — the song
 * page — says so with this. Cleared on unmount and whenever the route changes,
 * so a title never outlives the screen that set it.
 *
 * Lives apart from components/Seo so that file exports only components.
 */
export function useSeo(meta: Partial<SeoMeta> | null): void {
  const title = meta?.title
  const description = meta?.description
  useEffect(() => {
    if (!title && !description) return
    setScreenSeo({ ...(title ? { title } : {}), ...(description ? { description } : {}) })
    return () => setScreenSeo(null)
  }, [title, description])
}
