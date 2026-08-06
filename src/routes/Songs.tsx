import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Screen } from '../components/app/Screen'
import { useScreenScroll } from '../components/app/screenScroll'
import { Icon } from '../components/app/Icons'
import { SearchField } from '../components/app/SearchField'
import { searchSongs, type SongMeta } from '../lib/songs'

const PAGE = 50

export function Songs(): JSX.Element {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [songs, setSongs] = useState<SongMeta[] | null>(null)
  /** How many the search matched in all — only this page was fetched. */
  const [total, setTotal] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [error, setError] = useState(false)
  const scrollEl = useScreenScroll()

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200)
    return () => clearTimeout(t)
  }, [q])

  // A new search starts at the first page — page 7 of the old results has
  // nothing to do with what was just typed.
  useEffect(() => {
    setPage(0)
  }, [debounced])

  useEffect(() => {
    let alive = true
    searchSongs(debounced, page * PAGE, PAGE)
      .then((r) => {
        if (!alive) return
        setSongs(r.songs)
        setTotal(r.total)
      })
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [debounced, page])

  const pages = Math.max(1, Math.ceil((total ?? 0) / PAGE))
  const safePage = Math.min(page, pages - 1)
  const firstShown = !total ? 0 : safePage * PAGE + 1
  const lastShown = Math.min(total ?? 0, (safePage + 1) * PAGE)

  // Turning the page puts you at the top of it. Landing halfway down a fresh
  // fifty songs — where the last page happened to leave the scroll — reads as
  // the list having jumped rather than moved on.
  //
  // The reset has to wait for the new rows: doing it in the click handler puts
  // the scroll at 0 while the OLD page is still on screen, and the browser then
  // anchors the swapped-in rows back to where you were reading. Measured going
  // from page 2 to 3 — it left you at 2326px, the bottom of a page you had not
  // seen the top of.
  const turned = useRef(false)
  const turn = (to: number): void => {
    if (to === safePage) return
    turned.current = true
    setPage(to)
  }
  useLayoutEffect(() => {
    if (!turned.current || !songs) return
    turned.current = false
    scrollEl?.scrollTo({ top: 0 })
  }, [songs, scrollEl])

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

      {/* Paged rather than scrolling on forever: four and a half thousand songs
          is a book, and a book tells you where in it you are. An endless list
          answers "how much is left?" with nothing, and loses your place the
          moment you open a song and come back. */}
      {songs && songs.length > 0 && total !== null && (
        <div className="pager">
          <button
            type="button"
            className="icon-btn"
            onClick={() => turn(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
            aria-label="Previous page"
          >
            <Icon name="back" size={18} strokeWidth={2.2} />
          </button>
          <span className="pager-count">
            {firstShown.toLocaleString()}–{lastShown.toLocaleString()} of {total.toLocaleString()}
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => turn(Math.min(pages - 1, safePage + 1))}
            disabled={safePage >= pages - 1}
            aria-label="Next page"
          >
            <Icon name="chevron" size={18} strokeWidth={2.2} />
          </button>
        </div>
      )}
    </Screen>
  )
}
