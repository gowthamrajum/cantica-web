import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Screen } from '../components/app/Screen'
import { useScreenScroll } from '../components/app/screenScroll'
import { Icon } from '../components/app/Icons'
import { SearchField } from '../components/app/SearchField'
import { searchSongs, type SongMeta } from '../lib/songs'

const PAGE = 80

export function Songs(): JSX.Element {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [songs, setSongs] = useState<SongMeta[] | null>(null)
  /** How many the search matched in all — what tells the list to keep going. */
  const [total, setTotal] = useState<number | null>(null)
  const [error, setError] = useState(false)
  const scrollEl = useScreenScroll()
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    let alive = true
    setTotal(null)
    searchSongs(debounced, 0, PAGE)
      .then((r) => {
        if (!alive) return
        setSongs(r.songs)
        setTotal(r.total)
      })
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [debounced])

  /**
   * Infinite scroll — a "Show more" button is a website affordance; a list that
   * simply keeps going is the app one.
   *
   * Each turn of it now FETCHES the next page rather than revealing more of a
   * list already in hand: a search for a common word matches thousands of songs,
   * and carrying all of them out of the worker to show fifty is work nobody
   * asked for. `loading` guards against the observer firing twice before the
   * page it asked for has arrived.
   */
  const loading = useRef(false)
  useEffect(() => {
    const el = sentinel.current
    if (!el || !scrollEl || !songs || total === null || songs.length >= total) return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || loading.current) return
        loading.current = true
        const from = songs.length
        void searchSongs(debounced, from, PAGE)
          .then((r) => {
            // Appended by position, so a page that arrives late cannot
            // duplicate what is already on screen.
            setSongs((prev) => (prev && prev.length === from ? [...prev, ...r.songs] : prev))
          })
          .finally(() => {
            loading.current = false
          })
      },
      { root: scrollEl, rootMargin: '600px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [scrollEl, songs, total, debounced])

  const visible = useMemo(() => songs ?? [], [songs])
  const searching = debounced.trim().length > 0

  // Group into A/B/C-style sections by first character — the songbook is Telugu,
  // so the index letters are Telugu too, which is what a reader scans for.
  //
  // Results are ranked by how well they match, so while searching the letters
  // would be meaningless headings over an order that isn't alphabetical.
  const sections = useMemo(() => {
    if (searching) return [{ key: '', items: visible }]
    const out: { key: string; items: SongMeta[] }[] = []
    for (const s of visible) {
      const key = (s.song_name.trim()[0] ?? '·').toUpperCase()
      const last = out[out.length - 1]
      if (last && last.key === key) last.items.push(s)
      else out.push({ key, items: [s] })
    }
    return out
  }, [visible, searching])

  return (
    <Screen
      title="Songs"
      eyebrow="Worship songbook · కీర్తనలు"
      subtitle={
        !songs
          ? 'Our worship songbook'
          : searching
            ? // The COUNT is the whole match set, not the page in hand: only a
              // page is fetched now, and reporting its size told everyone that
              // "yesu" matched 80 songs when it matches two thousand.
              `${(total ?? songs.length).toLocaleString()} match${(total ?? songs.length) === 1 ? '' : 'es'} in titles and lyrics`
            : `${(total ?? songs.length).toLocaleString()} songs`
      }
      affix={
        <SearchField value={q} onChange={setQ} placeholder="Search titles and lyrics…" ariaLabel="Search songs" />
      }
    >
      {songs === null && !error && (
        <div className="flex items-center justify-center gap-2.5 py-20 text-[15px] text-ink-muted">
          <span className="spinner" /> Loading the songbook…
        </div>
      )}
      {error && <p className="py-20 text-center text-[15px] text-ink-muted">Couldn’t load the songbook.</p>}
      {songs && songs.length === 0 && (
        <p className="py-20 text-center text-[15px] text-ink-muted">No songs match “{debounced}”.</p>
      )}

      {sections.map((sec) => (
        <div key={sec.key} className="mt-1">
          {sec.key && <div className="index-head">{sec.key}</div>}
          <div className="list-group mt-2">
            {sec.items.map((s) => (
              <Link key={s.song_id} to={`/songs/${s.song_id}`} className="list-row has-ico">
                <span className="list-ico bg-gold-500 font-serif text-[15px] font-bold">♪</span>
                <span className="min-w-0 flex-1">
                  <span className="list-title block truncate">{s.song_name}</span>
                  {/* Matched on a line rather than the title — show which, or the
                      result looks like it has nothing to do with the search. */}
                  {s.snippet && <span className="list-sub block truncate">{s.snippet}</span>}
                </span>
                <Icon name="chevron" size={17} className="list-chev" />
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div ref={sentinel} aria-hidden="true" />
      {songs && total !== null && songs.length < total && (
        <div className="flex justify-center py-6">
          <span className="spinner" />
        </div>
      )}
    </Screen>
  )
}
