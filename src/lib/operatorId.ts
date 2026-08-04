const OPERATOR_KEY = 'tcc-operator-id'

/**
 * This device's identity for a service's operator seat.
 *
 * Kept rather than generated per visit: a refresh, a reconnect, or coming back
 * after the screen locked all have to be recognised as the SAME operator, or the
 * device would find itself locked out of the seat it is still holding.
 *
 * One id per device, not per role — the phone that starts a broadcast and then
 * opens the Operator page is still the same person holding the same seat.
 */
export function operatorId(): string {
  try {
    const saved = localStorage.getItem(OPERATOR_KEY)
    if (saved) return saved
    const id = `op-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(OPERATOR_KEY, id)
    return id
  } catch {
    // Private mode: an id that lasts as long as this page does still holds the
    // seat for the session, it just won't survive a reload.
    return `op-${Math.random().toString(36).slice(2, 10)}`
  }
}
