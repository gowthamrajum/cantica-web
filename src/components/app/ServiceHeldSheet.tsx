import { Sheet } from './Sheet'
import { Icon } from './Icons'
import { freeIn, type LockState } from '../../lib/access'

/**
 * Somebody else has this service open.
 *
 * Says who, says when it frees itself, and offers the one thing that is still
 * safe: reading it. Two people saving the same order in turn is how a Sunday
 * loses a song without anyone noticing — the last save wins and the other
 * person's work is simply gone, with nothing on screen to say so.
 *
 * The way out is a real one, not a dead end: View opens the service read-only,
 * which is what somebody wanting to check the order actually came for.
 */
export function ServiceHeldSheet({
  open,
  lock,
  onView,
  onClose
}: {
  open: boolean
  lock: LockState | null
  /** Open it anyway, without the ability to change it. */
  onView: () => void
  onClose: () => void
}): JSX.Element {
  return (
    <Sheet open={open} title="Someone else is editing" onClose={onClose}>
      <div className="px-[var(--gutter)]">
        <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50 p-3.5">
          <Icon name="people" size={20} className="mt-0.5 flex-none text-amber-700" />
          <p className="text-[14.5px] leading-relaxed text-amber-900">
            <b>{lock?.by ?? 'Someone else'}</b> is making changes to this service, so it can’t be changed here
            right now. You can still look at it.
            {lock?.freeInMs ? ` If they stop, it frees up in ${freeIn(lock.freeInMs)}.` : ''}
          </p>
        </div>

        <button className="btn-app btn-app-primary btn-block mt-3.5" onClick={onView}>
          View the service
        </button>
        <button className="btn-app btn-app-quiet btn-block mt-2" onClick={onClose}>
          Not now
        </button>
      </div>
    </Sheet>
  )
}
