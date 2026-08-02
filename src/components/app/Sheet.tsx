import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icons'

/**
 * A modal bottom sheet (centred dialog on desktop) — the native answer to a
 * picker, replacing the full-page overlays a website would use.
 *
 * Portalled to <body> so an ancestor's entrance `transform` can never capture
 * its fixed positioning, which would otherwise pin it to the screen box instead
 * of the viewport.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
  footer
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}): JSX.Element | null {
  // While a sheet is up, Escape closes it and the page behind must not scroll.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2 className="sheet-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} strokeWidth={2.2} />
          </button>
        </div>
        <div className="sheet-scroll">{children}</div>
        {footer}
      </div>
    </>,
    document.body
  )
}
