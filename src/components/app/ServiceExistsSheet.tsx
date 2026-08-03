import { Sheet } from './Sheet'
import { Icon } from './Icons'

/**
 * Raised when the chosen day and date already hold a service.
 *
 * One slot holds exactly one service, so there are only two honest things to do:
 * open the one that's there and edit it, or put this one on a different day or
 * date. Neither writes anything by itself — the sheet only decides which of the
 * two you're doing.
 */
export function ServiceExistsSheet({
  open,
  slotLabel,
  detail,
  busy,
  canLoad,
  onLoad,
  onNewSlot,
  onDismiss
}: {
  open: boolean
  slotLabel: string
  /** e.g. "Saved 2 days ago · 4 songs" — or why it can't be loaded. */
  detail?: string
  busy: boolean
  /** False for services saved before the builder recorded how they were made. */
  canLoad: boolean
  onLoad: () => void
  onNewSlot: () => void
  onDismiss: () => void
}): JSX.Element {
  return (
    <Sheet open={open} title="A service already exists" onClose={onDismiss}>
      <div className="px-[var(--gutter)]">
        <p className="-mt-1 mb-1 font-serif text-[17px] font-semibold text-ink">{slotLabel}</p>
        <p className="mb-4 text-[14.5px] leading-relaxed text-ink-muted">
          {detail ?? 'This day and date already has a service saved.'}
        </p>

        <div className="list-group">
          <button
            type="button"
            className="list-row has-ico"
            onClick={onLoad}
            disabled={busy || !canLoad}
          >
            <span className={`list-ico ${canLoad ? 'bg-navy-700' : 'bg-ink-muted'}`}>
              <Icon name="text" size={18} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="list-title block">{busy ? 'Loading…' : 'Load it and make edits'}</span>
              <span className="list-sub block">
                {canLoad
                  ? 'Open the saved service here, change it, and save it back'
                  : 'This one was saved before editing was supported, so it can’t be reopened'}
              </span>
            </span>
            {canLoad && <Icon name="chevron" size={17} className="list-chev" />}
          </button>

          <button type="button" className="list-row has-ico" onClick={onNewSlot} disabled={busy}>
            <span className="list-ico bg-gold-500">
              <Icon name="calendar" size={18} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="list-title block">Create a new service</span>
              <span className="list-sub block">Pick a different day and date, and leave this one alone</span>
            </span>
            <Icon name="chevron" size={17} className="list-chev" />
          </button>
        </div>
      </div>
    </Sheet>
  )
}
