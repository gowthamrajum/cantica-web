import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'
import { Segmented } from './Segmented'
import { Icon } from './Icons'
import { SearchField } from './SearchField'
import { countSongs, searchSongs, type SongMeta } from '../../lib/songs'
import { PsalmFields } from './PsalmFields'

export type PickSource = 'songs' | 'psalms'

/** A short list keeps the sheet a fixed, predictable height. */
const SHOWN = 6

/**
 * Picking what goes into a service, as a modal rather than a panel wedged into
 * the page. The builder screen is then just the service you're assembling — the
 * songbook only exists while you're actually choosing from it.
 *
 * Only the best few matches are shown, and there is no paging: you find a song
 * here by typing more of it, not by walking through two thousand results six at
 * a time. Browsing the songbook is what the Songs screen is for — that one is
 * paged.
 *
 * Search and psalm-reference state live here, not in the builder: they are
 * scratch input for this one interaction and shouldn't outlive it.
 */
export function ServicePickerSheet({
  open,
  source,
  allowPsalms,
  onSourceChange,
  onClose,
  onPickSong,
  onAddPsalm
}: {
  open: boolean
  source: PickSource
  /** False once the service already has its psalm — see Build.tsx. */
  allowPsalms: boolean
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
  /** How many the search matched in all — only the first few are fetched. */
  const [total, setTotal] = useState(0)
  /** The whole library's size, for the placeholder — not the match count. */
  const [library, setLibrary] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200)
    return () => clearTimeout(t)
  }, [q])

  // The songbook is already being loaded to search it, so asking its size costs
  // nothing beyond the first open.
  useEffect(() => {
    if (!open) return
    void countSongs().then(setLibrary)
  }, [open])

  /**
   * Only the handful being shown is fetched.
   *
   * A common word matches most of four and a half thousand songs, and the sheet
   * shows six of them. Carrying the rest out of the worker to render those six
   * is work nobody asked for — and it is paid on every keystroke.
   *
   * Only search while the sheet is actually up: no point filtering the whole
   * songbook for a list nobody is looking at.
   */
  useEffect(() => {
    let alive = true
    if (!open || source !== 'songs') return
    void searchSongs(debounced, 0, SHOWN).then((r) => {
      if (!alive) return
      setMatches(r.songs)
      setTotal(r.total)
    })
    return () => {
      alive = false
    }
  }, [debounced, source, open])

  const visible = matches ?? []

  return (
    <Sheet open={open} title="Add to service" onClose={onClose}>
      {/* With the psalm already placed there is nothing to switch between, so
          the control goes rather than sitting there disabled. */}
      {allowPsalms && (
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
      )}

      {source === 'songs' || !allowPsalms ? (
        <>
          <div className="mt-3 px-[var(--gutter)]">
            <SearchField
              value={q}
              onChange={setQ}
              placeholder={library ? `Search ${library.toLocaleString()} songs` : 'Search songs'}
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
                      {/* Matched on a lyric, so show the line — otherwise the row
                          looks unrelated to what was typed. */}
                      {s.snippet && <span className="list-sub block truncate">{s.snippet}</span>}
                    </span>
                    <Icon name="plus" size={18} className="list-chev" />
                  </button>
                ))}
              </div>

              {total > visible.length && (
                <p className="px-[var(--gutter)] pt-2.5 text-center text-[12.5px] text-ink-muted">
                  Showing {visible.length} of {total.toLocaleString()} — keep typing to narrow it down.
                </p>
              )}
            </>
          )}
          </div>
        </>
      ) : (
        <div className="mt-3">
          <PsalmFields
            submitVerb="Add"
            onSubmit={async (c, f, t) => {
              const ok = await onAddPsalm(c, f, t)
              if (ok) onClose()
              return ok
            }}
          />
        </div>
      )}
    </Sheet>
  )
}
