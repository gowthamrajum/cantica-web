import { useEffect, useMemo, useState } from 'react'
import { Sheet } from './Sheet'
import {
  DAYS,
  dayOf,
  isFirstSundayOfMonth,
  nextDateFor,
  occurrencesFor,
  prettyDate,
  shortDate,
  toISODate,
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

  // Only the chosen weekday's own dates are offered, so the two can never
  // disagree and there is no such thing as an invalid pick.
  const dates = useMemo(() => occurrencesFor(day), [day])
  // A slot being edited may sit outside the offered window; keep it selectable
  // rather than silently moving the service.
  const options = useMemo(
    () => (dates.includes(date) ? dates : [date, ...dates].filter((d) => dayOf(d) === day)),
    [dates, date, day]
  )
  const today = toISODate(new Date())
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

        <p className="mb-2 mt-6 text-[12px] font-bold uppercase tracking-[0.13em] text-ink-muted">
          Which {day}?
        </p>
        <div className="grid grid-cols-3 gap-2">
          {options.map((iso) => {
            const on = iso === date
            const past = iso < today
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setDate(iso)}
                aria-pressed={on}
                className={`pressable rounded-xl border px-2 py-2 text-center transition ${
                  on ? 'border-gold-400 bg-gold-50' : 'border-line bg-card'
                } ${past && !on ? 'opacity-55' : ''}`}
              >
                <span className={`block text-[13.5px] font-semibold ${on ? 'text-gold-700' : 'text-ink'}`}>
                  {shortDate(iso)}
                </span>
                <span className="mt-0.5 block text-[10.5px] leading-tight text-ink-muted">
                  {iso === today ? 'Today' : isFirstSundayOfMonth(iso) ? '1st Sunday' : past ? 'Past' : '\u00a0'}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2.5 text-[13px] text-ink-muted">
          {valid ? `Saving as ${day} · ${prettyDate(date)}` : 'Choose a date.'}
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
