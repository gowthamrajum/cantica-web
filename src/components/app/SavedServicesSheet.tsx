import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'
import { Icon } from './Icons'
import { listServices, type ServiceSummary } from '../../lib/relay'
import { prettyDate, toISODate } from '../../lib/serviceSlot'

/**
 * Every service the store is holding, whoever built it.
 *
 * The builder used to see one service at a time — whatever sat on the day and
 * date it was pointed at. That was enough while it was the only thing writing:
 * the presenter now publishes its own orders to the same store, and a service
 * assembled on the projection machine is one this app should be able to open,
 * read from and put on air, even though it can't be edited here.
 *
 * The rows come from the list endpoint, which deliberately omits the deck. So
 * this can say when a service was built and how big it is, but not what is in
 * it — that costs a request, and it is made when a row is actually chosen.
 */

/** Last week (the store's own retention) through the next three. */
const BACK_DAYS = 7
const AHEAD_DAYS = 21

function ago(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return 'recently'
  const mins = Math.round((Date.now() - then) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/** Rough size of the stored deck — the one thing the list endpoint does say
 *  about what's inside, and enough to tell a full order from a stub. */
function size(chars?: number): string {
  if (!chars) return ''
  return chars < 1024 ? `${chars} B` : `${Math.round(chars / 1024)} KB`
}

export function SavedServicesSheet({
  open,
  onClose,
  onPick,
  currentDate,
  currentDay,
  busyId
}: {
  open: boolean
  onClose: () => void
  onPick: (s: ServiceSummary) => void
  /** The slot the builder is pointed at, so its own service is marked. */
  currentDate?: string
  currentDay?: string
  /** The row being opened, while it is being fetched. */
  busyId?: number | null
}): JSX.Element {
  const [rows, setRows] = useState<ServiceSummary[] | null>(null)

  // Re-read on every open: the point of the list is that somebody else has
  // been editing, and a cached one would be exactly as stale as that suggests.
  useEffect(() => {
    if (!open) return
    let alive = true
    setRows(null)
    const day = 86_400_000
    const now = Date.now()
    void listServices(toISODate(new Date(now - BACK_DAYS * day)), toISODate(new Date(now + AHEAD_DAYS * day))).then(
      (list) => {
        if (alive) setRows(list)
      }
    )
    return () => {
      alive = false
    }
  }, [open])

  return (
    <Sheet open={open} title="Open a saved service" onClose={onClose}>
      <div className="px-[var(--gutter)]">
        <p className="-mt-1 mb-4 text-[14.5px] leading-relaxed text-ink-muted">
          Services saved from this app and published from the presenter computer, from last week through the next
          three.
        </p>
      </div>

      {rows === null && (
        <div className="app-card mx-[var(--gutter)] flex items-center gap-3 p-5">
          <span className="spinner" />
          <span className="text-[15px] text-ink-muted">Looking…</span>
        </div>
      )}

      {rows?.length === 0 && (
        <p className="px-[var(--gutter)] text-[15px] text-ink-muted">
          Nothing saved yet. Build a service here, or publish one from the presenter.
        </p>
      )}

      {!!rows?.length && (
        <div className="list-group">
          {rows.map((s) => {
            const mine = s.serviceDate === currentDate && s.serviceDay === currentDay
            return (
              <button
                key={s.id}
                type="button"
                className="list-row has-ico"
                onClick={() => onPick(s)}
                disabled={busyId != null}
              >
                <span className={`list-ico ${mine ? 'bg-gold-500' : 'bg-navy-700'}`}>
                  <Icon name="calendar" size={18} strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="list-title block truncate">
                    {s.serviceDay} · {prettyDate(s.serviceDate)}
                  </span>
                  <span className="list-sub block">
                    {busyId === s.id
                      ? 'Opening…'
                      : [mine ? 'The slot you’re on' : '', `Updated ${ago(s.updatedDateTime)}`, size(s.serviceDataLength)]
                          .filter(Boolean)
                          .join(' · ')}
                  </span>
                </span>
                <Icon name="chevron" size={17} className="list-chev" />
              </button>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}
