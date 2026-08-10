import type { ComponentType } from 'react'
import { useDevice } from '../lib/useDevice'

/**
 * Binds a screen's two versions into the single component a route mounts.
 *
 * Only the screens that genuinely differ are split this way. A screen with one
 * implementation stays a plain file in `routes/` and renders inside whichever
 * shell is up — so the rule reads off the file tree: if `routes/mobile/X.tsx`
 * exists, X has two versions and `routes/X.tsx` is the picker.
 */
export function byDevice(Mobile: ComponentType, Desktop: ComponentType): () => JSX.Element {
  return function DeviceScreen(): JSX.Element {
    return useDevice() === 'desktop' ? <Desktop /> : <Mobile />
  }
}
