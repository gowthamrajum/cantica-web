import { Sheet } from './Sheet'
import { Icon } from './Icons'

/**
 * Raised when the chosen day and date already hold a service.
 *
 * One slot holds exactly one service, so nothing here writes anything by
 * itself — the sheet only decides what you are doing with the one that's there:
 * edit it, read it, or leave it alone and put this service on another date.
 *
 * Reading is the answer for an order the presenter published. It cannot be
 * rearranged here, but it is still this Sunday's service, and the alternative —
 * telling someone the slot is taken and offering only a different date — is how
 * you end up with two services for one Sunday.
 */
export function ServiceExistsSheet({
  open,
  slotLabel,
  detail,
  busy,
  canLoad,
  canView,
  rebuilds,
  note,
  onLoad,
  onView,
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
  /** True when the deck can at least be read — anything this app understands. */
  canView?: boolean
  /** Editing this one means rebuilding it from its slides, not reopening it. */
  rebuilds?: boolean
  /** What just happened, when an action here had something to answer. */
  note?: string
  onLoad: () => void
  onView?: () => void
  onNewSlot: () => void
  onDismiss: () => void
}): JSX.Element {
  const readOnly = !!canView && !!onView
  return (
    <Sheet open={open} title="A service already exists" onClose={onDismiss}>
      <div className="px-[var(--gutter)]">
        <p className="-mt-1 mb-1 font-serif text-[17px] font-semibold text-ink">{slotLabel}</p>
        <p className="mb-4 text-[14.5px] leading-relaxed text-ink-muted">
          {detail ?? 'This day and date already has a service saved.'}
        </p>

        {/* An answer from one of the rows below. It has to live inside the
            sheet: the sheet covers the page, so an explanation printed behind
            it reads as the button having done nothing at all. */}
        {note && (
          <p className="mb-4 rounded-xl bg-amber-50 px-3.5 py-3 text-[14px] leading-relaxed text-amber-800">
            {note}
          </p>
        )}

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
                {!canLoad
                  ? 'This one was saved before editing was supported, so it can’t be reopened'
                  : rebuilds
                    ? 'Find its songs in the songbook and edit them here — it says what it can’t rebuild first'
                    : 'Open the saved service here, change it, and save it back'}
              </span>
            </span>
            {canLoad && <Icon name="chevron" size={17} className="list-chev" />}
          </button>

          {readOnly && (
            <button type="button" className="list-row has-ico" onClick={onView} disabled={busy}>
              <span className="list-ico bg-navy-500">
                <Icon name="eye" size={18} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="list-title block">Open it for reading</span>
                <span className="list-sub block">See its order, share the sheet, and broadcast it</span>
              </span>
              <Icon name="chevron" size={17} className="list-chev" />
            </button>
          )}

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
