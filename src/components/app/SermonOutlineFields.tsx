import { useState } from 'react'
import { pointsOf, type Outline } from '../../lib/outline'

/**
 * The sermon outline, as typed: a title and the preacher's points, one per line.
 *
 * It becomes one slide inside the sermon, straight after the card — and when a
 * verse quoted during the sermon is done, the presenter comes back to it, and
 * the operator's phone offers "Back to outline".
 *
 * The text is held here, raw, and only the parsed outline goes up: parsing on
 * every keystroke would drop the blank line Enter has just made, and the next
 * point could never be started. So the parent remounts this (by key) when the
 * outline is replaced from outside, rather than pushing a new value in.
 */
export function SermonOutlineFields({
  initial,
  onChange
}: {
  initial: Outline | null
  onChange: (next: Outline | null) => void
}): JSX.Element {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.points.join('\n') ?? '')

  const emit = (t: string, b: string): void => {
    const points = pointsOf(b)
    onChange(points.length ? { title: t.trim(), points } : null)
  }

  return (
    <div className="mt-1 space-y-2 px-[var(--gutter)]">
      <input
        className="search-field w-full"
        type="text"
        placeholder="Sermon title (optional)"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          emit(e.target.value, body)
        }}
      />
      <textarea
        className="search-field w-full"
        rows={6}
        placeholder={'Points, one per line\n1. He knows His sheep\n2. He leads His sheep\n3. He lays down His life'}
        value={body}
        onChange={(e) => {
          setBody(e.target.value)
          emit(title, e.target.value)
        }}
      />
      <p className="text-[13px] leading-relaxed text-ink-muted">
        One slide in the Sermon, straight after its card. When a verse read during the sermon is done, the screen
        comes back here — and the operator’s phone says <b>Back to outline</b>.
      </p>
    </div>
  )
}
