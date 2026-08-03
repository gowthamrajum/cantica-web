import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'
import { Segmented } from './Segmented'
import { Icon } from './Icons'
import { listSongs, type SongMeta } from '../../lib/songs'

export type PickSource = 'songs' | 'psalms'

/**
 * Picking what goes into a service, as a modal rather than a panel wedged into
 * the page. The builder screen is then just the service you're assembling — the
 * 1,596-song list only exists while you're actually choosing from it.
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
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [results, setResults] = useState<SongMeta[]>([])
  const [chapter, setChapter] = useState('23')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200)
    return () => clearTimeout(t)
  }, [q])

  // Only search while the sheet is actually up — no point filtering 1,596 songs
  // for a list nobody is looking at.
  useEffect(() => {
    let alive = true
    if (!open || source !== 'songs') return
    void listSongs(debounced).then((s) => alive && setResults(s.slice(0, 60)))
    return () => {
      alive = false
    }
  }, [debounced, source, open])

  const addPsalm = async (): Promise<void> => {
    setBusy(true)
    try {
      if (await onAddPsalm(chapter, from, to)) onClose()
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
            <label className="search-field">
              <Icon name="search" size={18} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search 1,596 songs"
                aria-label="Search songs"
                enterKeyHint="search"
              />
              {q && (
                <button type="button" onClick={() => setQ('')} aria-label="Clear search">
                  <Icon name="close" size={16} />
                </button>
              )}
            </label>
          </div>

          <div className="list-group mt-2">
            {results.map((s) => (
              <button key={s.song_id} className="list-row w-full text-left" onClick={() => onPickSong(s)}>
                <span className="min-w-0 flex-1">
                  <span className="list-title block truncate">{s.song_name}</span>
                </span>
                <Icon name="plus" size={18} className="list-chev" />
              </button>
            ))}
            {results.length === 0 && (
              <div className="px-4 py-4 text-[14px] text-ink-muted">
                {debounced ? `No songs match “${debounced}”.` : 'Loading the songbook…'}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="mt-3 px-[var(--gutter)]">
          <div className="grid grid-cols-3 gap-2">
            <label className="min-w-0">
              <span className="list-label">Psalm</span>
              <span className="search-field mt-1">
                <input inputMode="numeric" value={chapter} onChange={(e) => setChapter(e.target.value)} aria-label="Psalm number" />
              </span>
            </label>
            <label className="min-w-0">
              <span className="list-label">From</span>
              <span className="search-field mt-1">
                <input inputMode="numeric" value={from} placeholder="all" onChange={(e) => setFrom(e.target.value)} aria-label="First verse" />
              </span>
            </label>
            <label className="min-w-0">
              <span className="list-label">To</span>
              <span className="search-field mt-1">
                <input inputMode="numeric" value={to} placeholder="all" onChange={(e) => setTo(e.target.value)} aria-label="Last verse" />
              </span>
            </label>
          </div>
          <button className="btn-app btn-app-primary btn-block mt-4" onClick={() => void addPsalm()} disabled={busy}>
            {busy ? 'Adding…' : 'Add psalm'}
          </button>
          <p className="pb-2 pt-3 text-[13px] leading-relaxed text-ink-muted">
            Leave From and To empty for the whole psalm. It lands as a responsive reading, Telugu and English
            together.
          </p>
        </div>
      )}
    </Sheet>
  )
}
