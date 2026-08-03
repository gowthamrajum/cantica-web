import type { ReactNode } from 'react'
import { Icon } from './Icons'

/**
 * A disclosure section: a header that always shows enough to know what is
 * inside, and a body that opens on tap.
 *
 * The body animates with `grid-template-rows: 0fr → 1fr` rather than a
 * max-height guess, so it opens to exactly its own height however tall that is
 * — a max-height large enough for the longest case makes every shorter one
 * snap open at the wrong speed.
 */
export function Collapsible({
  title,
  summary,
  open,
  onToggle,
  children,
  className = ''
}: {
  title: string
  /** Shown beside the title while closed — what you'd otherwise open it to check. */
  summary?: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
  className?: string
}): JSX.Element {
  return (
    <div className={className}>
      <button type="button" className="collapsible-head" onClick={onToggle} aria-expanded={open}>
        <span className="collapsible-title">{title}</span>
        {!open && summary != null && <span className="collapsible-summary">{summary}</span>}
        <Icon
          name="chevron"
          size={16}
          strokeWidth={2.4}
          className={`flex-none text-ink-muted transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </button>
      <div className={`collapsible-body${open ? ' is-open' : ''}`}>
        <div>{children}</div>
      </div>
    </div>
  )
}
