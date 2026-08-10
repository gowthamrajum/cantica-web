import type { ReactNode } from 'react'

/**
 * Telugu text, told apart from the English around it.
 *
 * Without `lang="te"` a screen reader announces తెలుగు కమ్యూనిటీ చర్చి with an
 * English voice and English pronunciation rules, which produces noise rather
 * than words; a search engine indexes it as English; and a browser picks font
 * fallbacks and line-breaking for the wrong script. The app is bilingual on
 * nearly every screen, so this is not an edge case — it is half the content.
 *
 * A span by default because most Telugu here sits inside a sentence or a
 * heading that is already an element; pass `as` when it needs to be the block
 * itself.
 */
export function Te({
  children,
  className,
  as: Tag = 'span'
}: {
  children: ReactNode
  className?: string
  as?: 'span' | 'p' | 'div' | 'h1' | 'h2'
}): JSX.Element {
  return (
    <Tag lang="te" className={className}>
      {children}
    </Tag>
  )
}
