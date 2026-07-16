const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

/**
 * Tidy a broadcast service name for display. Older desktop builds stamp a service
 * with an ISO-ish timestamp (e.g. "Sunday Worship Service · 2026-07-14 03:18");
 * rewrite any such "YYYY-MM-DD [HH:MM]" run to a friendly "July 14, 2026" so the
 * name reads like a date. Newer desktop builds already produce this format.
 */
export function prettyServiceName(name?: string | null): string {
  if (!name) return 'Live Service'
  return name.replace(/(\d{4})-(\d{2})-(\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2})?)?/g, (_m, y, mo, d) => {
    const mi = parseInt(mo, 10) - 1
    return `${MONTHS[mi] ?? mo} ${parseInt(d, 10)}, ${y}`
  })
}
