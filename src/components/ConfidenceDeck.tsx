import { ConfidenceCard } from './ConfidenceCard'
import type { LiveState } from '../lib/relay'

/**
 * What is on the screen, and what is coming — the pair, stacked.
 *
 * Shared by the operator remote and the audience channel so the two cannot
 * drift: the sizing rules, the label placement and the way a card gives up its
 * caption before it gives up words are decided once, here and in ConfidenceCard,
 * rather than twice in two routes that look the same until one is edited.
 *
 * The next card is rendered from a copy of the live state with the blank/logo
 * flags cleared, so it previews the actual upcoming content rather than
 * inheriting a blackout that applies only to what is on screen now.
 */
export function ConfidenceDeck({
  state,
  /**
   * What to say when there is no next slide.
   *
   * The operator can be told "End of service" because for them an absent next
   * means exactly that. For the audience it does not: the desktop can hold an
   * item back from the users channel, so `next` is also null for a slide that
   * exists but is not theirs to see. Saying the service had ended would be a
   * plain lie, so that caller passes something that claims nothing.
   */
  emptyNext = 'End of service'
}: {
  state: LiveState | null
  emptyNext?: string
}): JSX.Element {
  const next = state?.next
    ? { ...state, slide: state.next, next: null, blackout: false, clearText: false, showLogo: false }
    : null

  // Own wrapper, because the two cards turn side by side on a wide screen and
  // the operator's sermon nav and take-off-stream button — siblings in
  // .op2-body — must not turn with them.
  return (
    <div className="op2-deck">
      <section className="op2-section op2-section-current">
        <div className="op2-label">Current</div>
        <div className="op2-card">
          <ConfidenceCard state={state} />
        </div>
      </section>
      <section className="op2-section op2-section-next">
        <div className="op2-label">Next</div>
        <div className="op2-card">
          {next ? <ConfidenceCard state={next} /> : <div className="op2-end">{emptyNext}</div>}
        </div>
      </section>
    </div>
  )
}
