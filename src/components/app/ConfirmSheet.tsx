import type { ReactNode } from 'react'
import { Sheet } from './Sheet'

/**
 * A yes/no question. The confirm action is spelled out as a verb phrase rather
 * than "OK", so the button says what will happen without re-reading the prompt.
 */
export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onCancel
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'primary' | 'warn'
  onConfirm: () => void
  onCancel: () => void
}): JSX.Element {
  return (
    <Sheet open={open} title={title} onClose={onCancel}>
      <div className="px-[var(--gutter)] pb-2">
        <p className="-mt-1 text-[14.5px] leading-relaxed text-ink-soft">{message}</p>
        <div className="mt-5 flex gap-2.5">
          <button type="button" className="btn-app btn-app-quiet flex-1 text-[15px]" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn-app flex-1 text-[15px] ${tone === 'warn' ? 'btn-app-gold' : 'btn-app-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
