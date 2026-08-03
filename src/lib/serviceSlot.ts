/**
 * A service's slot: which weekday it falls on and its calendar date. These are
 * the two fields the relay keys a service on — `(serviceDate, serviceDay)` is
 * UNIQUE — so the builder settles them before anything is picked.
 *
 * Everything here works in LOCAL time on purpose. `new Date('2026-08-09')`
 * parses as UTC midnight, which is the previous evening anywhere west of
 * Greenwich, so its `getDay()` reports the wrong weekday. Dates are therefore
 * built with `new Date(y, m - 1, d)` and formatted by hand rather than through
 * toISOString().
 */

export const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
] as const
export type DayName = (typeof DAYS)[number]

export interface ServiceSlot {
  day: DayName
  /** 'YYYY-MM-DD' */
  date: string
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`)

/** 'YYYY-MM-DD' for a Date, read in local time. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Parse 'YYYY-MM-DD' as a local calendar date. Returns null if malformed. */
export function fromISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(y, mo - 1, d)
  // Rejects impossible dates that JS would roll over (e.g. 2026-02-31 → Mar 3).
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? dt : null
}

/** The weekday a date falls on, or null if the date doesn't parse. */
export function dayOf(iso: string): DayName | null {
  const d = fromISODate(iso)
  return d ? DAYS[d.getDay()] : null
}

/**
 * The next date on or after `from` that falls on `day` — so choosing "Sunday"
 * proposes this coming Sunday rather than a date in the past.
 */
export function nextDateFor(day: DayName, from: Date = new Date()): string {
  const target = DAYS.indexOf(day)
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  base.setDate(base.getDate() + ((target - base.getDay() + 7) % 7))
  return toISODate(base)
}

/** "August 9, 2026" */
export function prettyDate(iso: string): string {
  const d = fromISODate(iso)
  if (!d) return iso
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

/** "Sunday · August 9, 2026" */
export function prettySlot(slot: ServiceSlot): string {
  return `${slot.day} · ${prettyDate(slot.date)}`
}

/** The slot the builder opens on: the next Sunday, the usual gathering. */
export function defaultSlot(now: Date = new Date()): ServiceSlot {
  return { day: 'Sunday', date: nextDateFor('Sunday', now) }
}

/**
 * Whether a date is the month's first Sunday — by definition the Sunday falling
 * on the 1st to the 7th. Communion is served then, so the builder only offers
 * the communion roles on such a date. Mirrors lumen-presenter's isFirstSunday;
 * keep the two in step or the two apps disagree about which Sunday it is.
 */
export function isFirstSundayOfMonth(iso: string): boolean {
  const d = fromISODate(iso)
  return !!d && d.getDay() === 0 && d.getDate() <= 7
}

/**
 * How far past its date a service is, in whole days — the relay purges anything
 * more than 7 days old, so the builder can warn before you save into that.
 */
export function daysPast(iso: string, now: Date = new Date()): number {
  const d = fromISODate(iso)
  if (!d) return 0
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((today.getTime() - d.getTime()) / 86_400_000)
}
