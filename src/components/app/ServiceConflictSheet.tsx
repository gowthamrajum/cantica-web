import { Sheet } from './Sheet'
import { Icon } from './Icons'

/**
 * Shown when a save would land on a slot that already holds a service — either
 * because we knew the slot was taken, or because the relay answered 409.
 *
 * Overwriting a Sunday deck is not something to do on a single tap, so this
 * asks first, and both ways out are spelled out by consequence: go back and
 * change something, or push this deck over the saved one.
 */
export function ServiceConflictSheet({
  open,
  message,
  slotLabel,
  saving,
  onEdit,
  onContinue
}: {
  open: boolean
  message: string
  slotLabel: string
  saving: boolean
  /** Dismiss and return to the builder — nothing is written. */
  onEdit: () => void
  /** Replace the stored service with the deck in hand. */
  onContinue: () => void
}): JSX.Element {
  return (
    <Sheet open={open} title="A service already exists" onClose={onEdit}>
      <div className="px-[var(--gutter)]">
        <p className="-mt-1 mb-1 font-serif text-[17px] font-semibold text-ink">{slotLabel}</p>
        <p className="mb-4 text-[14.5px] leading-relaxed text-ink-muted">{message}</p>

        <div className="list-group">
          <button type="button" className="list-row has-ico" onClick={onEdit} disabled={saving}>
            <span className="list-ico bg-navy-700">
              <Icon name="text" size={18} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="list-title block">Make edits</span>
              <span className="list-sub block">
                Go back without saving — change the day, date, or what’s in the service
              </span>
            </span>
            <Icon name="chevron" size={17} className="list-chev" />
          </button>

          <button type="button" className="list-row has-ico" onClick={onContinue} disabled={saving}>
            <span className="list-ico bg-red-500">
              <Icon name="check" size={18} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="list-title block">
                {saving ? 'Saving…' : 'Continue with new service'}
              </span>
              <span className="list-sub block">Replace the saved service with this one</span>
            </span>
          </button>
        </div>
      </div>
    </Sheet>
  )
}
