import { useEffect, useMemo, useState } from 'react'
import { Sheet } from './Sheet'
import { Segmented } from './Segmented'
import { Icon } from './Icons'
import { SearchField } from './SearchField'
import { listSongs, type SongMeta } from '../../lib/songs'
import { loadBible } from '../../lib/bible'

export type PickSource = 'songs' | 'psalms'

/** A short page keeps the sheet a fixed, predictable height. */
const PAGE_SIZE = 6

/**
 * Picking what goes into a service, as a modal rather than a panel wedged into
 * the page. The builder screen is then just the service you're assembling — the
 * 1,596-song list only exists while you're actually choosing from it.
 *
 * Results are paged rather than dumped: rendering the whole match set made the
 * sheet grow to the height of the songbook, which is unusable on a phone and
 * pointless when you're picking one song.
 *
 * Search and psalm-reference state live here, not in the builder: they are
 * scratch input for this one interaction and shouldn't outlive it.
 */
export function ServicePickerSheet({
  open,
  source,
  onSourceChange,
  onClose,
  onPickSong,
  onAddPsalm
}: {
  open: boolean
  source: PickSource
  onSourceChange: (s: PickSource) => void
  onClose: () => void
  onPickSong: (meta: SongMeta) => void
  /** Resolves true when the psalm was added, so the sheet knows to close. */
  onAddPsalm: (chapter: string, from: string, to: string) => Promise<boolean>
}): JSX.Element {
  // ----- songs -----
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [matches, setMatches] = useState<SongMeta[] | null>(null)
  const [page, setPage] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200)
    return () => clearTimeout(t)
  }, [q])

  // Only search while the sheet is actually up — no point filtering 1,596 songs
  // for a list nobody is looking at.
  useEffect(() => {
    let alive = true
    if (!open || source !== 'songs') return
    setPage(0)
    void listSongs(debounced).then((s) => alive && setMatches(s))
    return () => {
      alive = false
    }
  }, [debounced, source, open])

  const total = matches?.length ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, pages - 1)
  const visible = useMemo(
    () => (matches ?? []).slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [matches, safePage]
  )
  const firstShown = total === 0 ? 0 : safePage * PAGE_SIZE + 1
  const lastShown = Math.min(total, (safePage + 1) * PAGE_SIZE)

  // ----- psalms -----
  const [chapter, setChapter] = useState('23')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  /** chapter number -> how many verses it has */
  const [verseCounts, setVerseCounts] = useState<Record<number, number> | null>(null)

  // The psalm's length is what makes From/To meaningful, so read it from the
  // bundled bible as soon as the psalm tab is opened.
  useEffect(() => {
    let alive = true
    if (!open || source !== 'psalms' || verseCounts) return
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
  }, [open, source, verseCounts])

  const ch = Number(chapter)
  const chapterOk = Number.isInteger(ch) && ch >= 1 && ch <= 150
  const count = chapterOk ? (verseCounts?.[ch] ?? null) : null
  const lo = from.trim() ? Number(from) : null
  const hi = to.trim() ? Number(to) : null

  const rangeError = ((): string | null => {
    if (!chapterOk) return 'Psalms go from 1 to 150.'
    if (count === null) return null // still loading
    if (lo !== null && (!Number.isInteger(lo) || lo < 1 || lo > count)) return `First verse must be between 1 and ${count}.`
    if (hi !== null && (!Number.isInteger(hi) || hi < 1 || hi > count)) return `Last verse must be between 1 and ${count}.`
    if (lo !== null && hi !== null && lo > hi) return 'First verse must not be after the last.'
    return null
  })()

  const willAdd =
    count === null
      ? ''
      : lo !== null || hi !== null
        ? `Psalm ${ch}:${lo ?? 1}–${hi ?? count}`
        : `Psalm ${ch}, all ${count} verses`

  const addPsalm = async (): Promise<void> => {
    setBusy(true)
    try {
      // An open-ended range still needs both ends for the builder, so fill the
      // blank side from the psalm's own bounds.
      const f = lo !== null || hi !== null ? String(lo ?? 1) : ''
      const t = lo !== null || hi !== null ? String(hi ?? count ?? '') : ''
      if (await onAddPsalm(chapter, f, t)) onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} title="Add to service" onClose={onClose}>
      <div className="px-[var(--gutter)]">
        <Segmented
          options={[
            { id: 'songs', label: 'Songs' },
            { id: 'psalms', label: 'Psalms' }
          ]}
          value={source}
          onChange={onSourceChange}
          ariaLabel="What to add"
        />
      </div>

      {source === 'songs' ? (
        <>
          <div className="mt-3 px-[var(--gutter)]">
            <SearchField
              value={q}
              onChange={setQ}
              placeholder="Search 1,596 songs"
              ariaLabel="Search songs"
            />
          </div>

          {/* A fixed-height results area: the sheet is anchored to the bottom of
              the screen, so letting it grow and shrink with the match count
              slides every control under the user's finger while they type. */}
          <div className="picker-results">
          {matches === null ? (
            <div className="flex items-center justify-center gap-2.5 py-10 text-[14px] text-ink-muted">
              <span className="spinner" /> Loading the songbook…
            </div>
          ) : total === 0 ? (
            <p className="py-10 text-center text-[14px] text-ink-muted">
              No songs match “{debounced}”.
            </p>
          ) : (
            <>
              <div className="list-group mt-2">
                {visible.map((s) => (
                  <button key={s.song_id} className="list-row w-full text-left" onClick={() => onPickSong(s)}>
                    <span className="min-w-0 flex-1">
                      <span className="list-title block truncate">{s.song_name}</span>
                    </span>
                    <Icon name="plus" size={18} className="list-chev" />
                  </button>
                ))}
              </div>

              <div className="mt-2 flex items-center justify-between gap-2 px-[var(--gutter)]">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  aria-label="Previous page"
                >
                  <Icon name="back" size={18} strokeWidth={2.2} />
                </button>
                <span className="text-[13px] tabular-nums text-ink-muted">
                  {firstShown}–{lastShown} of {total.toLocaleString()}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                  disabled={safePage >= pages - 1}
                  aria-label="Next page"
                >
                  <Icon name="chevron" size={18} strokeWidth={2.2} />
                </button>
              </div>
              {total > PAGE_SIZE && (
                <p className="px-[var(--gutter)] pt-1.5 text-center text-[12.5px] text-ink-muted">
                  Keep typing to narrow it down.
                </p>
              )}
            </>
          )}
          </div>
        </>
      ) : (
        <div className="mt-3 px-[var(--gutter)]">
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
            onClick={() => void addPsalm()}
            disabled={busy || !!rangeError || count === null}
          >
            {busy ? 'Adding…' : willAdd ? `Add ${willAdd}` : 'Add psalm'}
          </button>
          <p className="pb-2 pt-3 text-[13px] leading-relaxed text-ink-muted">
            It lands as a responsive reading, Telugu and English together.
          </p>
        </div>
      )}
    </Sheet>
  )
}
