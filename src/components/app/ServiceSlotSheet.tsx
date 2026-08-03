import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'
import {
  DAYS,
  dayOf,
  nextDateFor,
  prettyDate,
  type DayName,
  type ServiceSlot
} from '../../lib/serviceSlot'

/**
 * The first thing Service Builder asks: which day this gathering is, and on what
 * date. Together they're the slot the relay keys a service on.
 *
 * The two fields are kept in step rather than left to disagree — picking a
 * weekday jumps the date to its next occurrence, and picking a date re-reads the
 * weekday from it. A service dated a Sunday but labelled Monday would occupy a
 * slot nobody could find again.
 */
export function ServiceSlotSheet({
  open,
  slot,
  onCancel,
  onConfirm
}: {
  open: boolean
  slot: ServiceSlot
  onCancel: () => void
  onConfirm: (slot: ServiceSlot) => void
}): JSX.Element {
  const [day, setDay] = useState<DayName>(slot.day)
  const [date, setDate] = useState(slot.date)

  // Re-seed each time it opens, so reopening shows the slot in force — not
  // whatever half-edit was abandoned last time.
  useEffect(() => {
    if (open) {
      setDay(slot.day)
      setDate(slot.date)
    }
  }, [open, slot.day, slot.date])

  const pickDay = (d: DayName): void => {
    setDay(d)
    setDate(nextDateFor(d))
  }

  const pickDate = (iso: string): void => {
    setDate(iso)
    const d = dayOf(iso)
    if (d) setDay(d)
  }

  const valid = !!dayOf(date)

  return (
    <Sheet open={open} title="When is this service?" onClose={onCancel}>
      <div className="px-[var(--gutter)]">
        <p className="-mt-1 mb-4 text-[14px] leading-relaxed text-ink-muted">
          Pick the day and date first — the service is filed under them, and one service can be saved per slot.
        </p>

        <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.13em] text-ink-muted">Day of service</p>
        <div className="grid grid-cols-4 gap-2">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => pickDay(d)}
              aria-pressed={d === day}
              className={`pressable rounded-xl border px-2 py-2.5 text-[13px] font-semibold transition ${
                d === day ? 'border-gold-400 bg-gold-50 text-gold-700' : 'border-line bg-card text-ink'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <p className="mb-2 mt-6 text-[12px] font-bold uppercase tracking-[0.13em] text-ink-muted">Date of service</p>
        <label className="search-field">
          <input
            type="date"
            value={date}
            onChange={(e) => pickDate(e.target.value)}
            aria-label="Date of service"
            className="w-full bg-transparent outline-none"
          />
        </label>
        <p className="mt-2 text-[13px] text-ink-muted">
          {valid ? `Saving as ${day} · ${prettyDate(date)}` : 'Choose a valid date.'}
        </p>

        <button
          type="button"
          className="btn-app btn-app-primary btn-block mt-5"
          disabled={!valid}
          onClick={() => onConfirm({ day, date })}
        >
          Continue
        </button>
      </div>
    </Sheet>
  )
}
