import type { Theme } from './relay'

/**
 * How slide text stands off its background — the presenter's Outline setting,
 * so a phone shows what the projector shows. A thin solid black outline by
 * default (it reads over a bright or moving background where a soft shadow
 * fades); with it off, the soft shadow if that is on. Mirrors
 * lumen-presenter's shared/textEffect.ts — keep the two in step.
 */
export const outlineOn = (theme?: Theme | null): boolean => theme?.outline !== false

/** ' outline', ' shadow' or '' — appended to a text element's className. */
export function textEffectClass(theme?: Theme | null): string {
  if (outlineOn(theme)) return ' outline'
  return theme?.shadow !== false ? ' shadow' : ''
}
