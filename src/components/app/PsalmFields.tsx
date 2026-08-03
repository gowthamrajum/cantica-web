import { useEffect, useState } from 'react'
import { loadBible } from '../../lib/bible'

/**
 * Choosing a psalm and its verse range.
 *
 * Shared by the picker (adding one) and the edit sheet (changing the one that
 * is already there), because the two need identical rules: the same 1–150
 * bound, the same verse count read from the bundled bible, and the same
 * refusal of a range that psalm does not have. Two copies of that drift.
 */
export function PsalmFields({
  initial,
  submitVerb,
  onSubmit
}: {
  initial?: { chapter: number; from?: number; to?: number }
  /** 'Add' when it is landing, 'Save' when an existing one is being changed. */
  submitVerb: string
  /** Resolves true when it was accepted, so the caller can close. */
  onSubmit: (chapter: string, from: string, to: string) => Promise<boolean>
}): JSX.Element {
  const [chapter, setChapter] = useState(String(initial?.chapter ?? 23))
  const [from, setFrom] = useState(initial?.from != null ? String(initial.from) : '')
  const [to, setTo] = useState(initial?.to != null ? String(initial.to) : '')
  const [busy, setBusy] = useState(false)
  /** chapter number -> how many verses it has */
  const [verseCounts, setVerseCounts] = useState<Record<number, number> | null>(null)

  // The psalm's length is what makes From/To meaningful.
  useEffect(() => {
    let alive = true
    void loadBible('telugu').then((b) => {
      if (!alive) return
      const counts: Record<number, number> = {}
      for (const [ch, verses] of Object.entries(b.byBook['Psalms'] ?? {})) {
        counts[Number(ch)] = verses.length
      }
      setVerseCounts(counts)
    })
    return () => {
      alive = false
    }
  }, [])

  const ch = Number(chapter)
  const chapterOk = Number.isInteger(ch) && ch >= 1 && ch <= 150
  const count = chapterOk ? (verseCounts?.[ch] ?? null) : null
  const lo = from.trim() ? Number(from) : null
  const hi = to.trim() ? Number(to) : null

  const rangeError = ((): string | null => {
    if (!chapterOk) return 'Psalms go from 1 to 150.'
    if (count === null) return null // still loading
    if (lo !== null && (!Number.isInteger(lo) || lo < 1 || lo > count))
      return `First verse must be between 1 and ${count}.`
    if (hi !== null && (!Number.isInteger(hi) || hi < 1 || hi > count))
      return `Last verse must be between 1 and ${count}.`
    if (lo !== null && hi !== null && lo > hi) return 'First verse must not be after the last.'
    return null
  })()

  const willBe =
    count === null
      ? ''
      : lo !== null || hi !== null
        ? `Psalm ${ch}:${lo ?? 1}–${hi ?? count}`
        : `Psalm ${ch}, all ${count} verses`

  const submit = async (): Promise<void> => {
    setBusy(true)
    try {
      // An open-ended range still needs both ends downstream, so the blank side
      // is filled from the psalm's own bounds.
      const f = lo !== null || hi !== null ? String(lo ?? 1) : ''
      const t = lo !== null || hi !== null ? String(hi ?? count ?? '') : ''
      await onSubmit(chapter, f, t)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-[var(--gutter)]">
      <div className="grid grid-cols-3 gap-2">
        <label className="min-w-0">
          <span className="list-label">Psalm</span>
          <span className="search-field mt-1">
            <input
              inputMode="numeric"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              aria-label="Psalm number"
              placeholder="1–150"
            />
          </span>
        </label>
        <label className="min-w-0">
          <span className="list-label">From</span>
          <span className="search-field mt-1">
            <input
              inputMode="numeric"
              value={from}
              placeholder={count ? '1' : '—'}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="First verse"
            />
          </span>
        </label>
        <label className="min-w-0">
          <span className="list-label">To</span>
          <span className="search-field mt-1">
            <input
              inputMode="numeric"
              value={to}
              placeholder={count ? String(count) : '—'}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Last verse"
            />
          </span>
        </label>
      </div>

      <p className="mt-2.5 text-[13px] leading-relaxed text-ink-muted">
        {!chapterOk ? (
          'Psalms go from 1 to 150.'
        ) : count === null ? (
          'Checking that psalm…'
        ) : (
          <>
            <b className="text-ink">
              Psalm {ch} has {count} verse{count === 1 ? '' : 's'}
            </b>{' '}
            (1–{count}). Leave From and To empty for the whole psalm.
          </>
        )}
      </p>

      {rangeError && <p className="mt-1.5 text-[13px] font-medium text-red-600">{rangeError}</p>}

      <button
        className="btn-app btn-app-primary btn-block mt-3.5"
        onClick={() => void submit()}
        disabled={busy || !!rangeError || count === null}
      >
        {busy ? 'Working…' : willBe ? `${submitVerb} ${willBe}` : `${submitVerb} psalm`}
      </button>
      <p className="pb-2 pt-3 text-[13px] leading-relaxed text-ink-muted">
        It lands as a responsive reading, Telugu and English together.
      </p>
    </div>
  )
}
