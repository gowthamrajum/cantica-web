import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Band, Page } from '../../components/desktop/Page'
import { Icon } from '../../components/app/Icons'
import { SearchField } from '../../components/app/SearchField'
import { Te } from '../../components/Te'
import { CHURCH } from '../../lib/church'
import { searchSongs, type SongMeta } from '../../lib/songs'

/**
 * A page bigger than a page can be scrolled by hand: 60 rather than the
 * phone's 50, because three columns of twenty is one screenful on a laptop and
 * turning the page twice as often is the cost of pretending otherwise.
 */
const PAGE = 60

/**
 * The songbook on a laptop.
 *
 * The phone screen is one column under a collapsing title, which on a 1280px
 * page leaves a 672px strip of song titles down the middle and half the window
 * empty. Here the same paged search is laid out as a page: the search sits in
 * the hero where a visitor looks first, and the results run in columns.
 *
 * The search and paging are the phone's — searchSongs fetches one page rather
 * than every match, so typing a common word does not carry two thousand rows
 * out of the worker to render sixty.
 */
export function Songs(): JSX.Element {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [songs, setSongs] = useState<SongMeta[] | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [error, setError] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200)
    return () => clearTimeout(t)
  }, [q])

  // A new search starts at the first page.
  useEffect(() => setPage(0), [debounced])

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
  const searching = debounced.trim().length > 0

  const turn = (to: number): void => {
    if (to === safePage) return
    setPage(to)
    // The results are a band down the page, so a page turn goes back to the top
    // of them rather than leaving you halfway down a fresh sixty.
    document.querySelector('.dk-songs-band')?.scrollIntoView({ block: 'start' })
  }

  /**
   * Grouped by first letter, as the phone does — the songbook is Telugu, so the
   * index letters are Telugu, which is what a reader scans for. Not while
   * searching: results are ranked by match, and letters over an order that is
   * not alphabetical are headings that mean nothing.
   */
  const sections = useMemo(() => {
    const visible = songs ?? []
    if (searching) return [{ key: '', items: visible }]
    const out: { key: string; items: SongMeta[] }[] = []
    for (const s of visible) {
      const key = (s.song_name.trim()[0] ?? '·').toUpperCase()
      const last = out[out.length - 1]
      if (last && last.key === key) last.items.push(s)
      else out.push({ key, items: [s] })
    }
    return out
  }, [songs, searching])

  return (
    <Page
      title={`Songs · ${CHURCH.name}`}
      hero={
        <div className="dk-hero dk-hero-light">
          <div className="dk-wrap">
            <div className="dk-hero-row is-single">
              <div>
                <span className="dk-eyebrow">Worship songbook</span>
                <h1 className="dk-hero-title">
                  Songs <Te>· కీర్తనలు</Te>
                </h1>
                <p className="dk-hero-lede">
                  {total === null
                    ? 'Every song we sing, in Telugu and English.'
                    : searching
                      ? `${total.toLocaleString()} match${total === 1 ? '' : 'es'} in titles and lyrics.`
                      : `All ${total.toLocaleString()} of them, in Telugu and English.`}
                </p>
                <div className="dk-songs-search">
                  <SearchField
                    value={q}
                    onChange={setQ}
                    placeholder="Search titles and lyrics…"
                    ariaLabel="Search songs"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <Band className="dk-songs-band">
        <div className="dk-wrap">
          {songs === null && !error && (
            <div className="dk-songs-note">
              <span className="spinner" /> Loading the songbook…
            </div>
          )}
          {error && <p className="dk-songs-note">Couldn’t load the songbook.</p>}
          {songs && songs.length === 0 && (
            <p className="dk-songs-note">No songs match “{debounced}”.</p>
          )}

          {sections.map((sec) => (
            <div key={sec.key} className="dk-songs-section">
              {sec.key && (
                <div className="dk-songs-letter">
                  <Te>{sec.key}</Te>
                </div>
              )}
              <div className="dk-songs-grid">
                {sec.items.map((s) => (
                  <Link key={s.song_id} to={`/songs/${s.song_id}`} className="dk-song">
                    <span className="dk-song-mark">♪</span>
                    <span className="dk-song-text">
                      <span className="dk-song-name">{s.song_name}</span>
                      {/* Matched on a lyric rather than the title — show which,
                          or the result looks unrelated to what was typed. */}
                      {s.snippet && <span className="dk-song-snippet">{s.snippet}</span>}
                    </span>
                    <Icon name="chevron" size={16} className="dk-song-chev" />
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {songs && songs.length > 0 && total !== null && (
            <div className="dk-songs-pager">
              <button
                type="button"
                className="dk-pager-btn"
                onClick={() => turn(Math.max(0, safePage - 1))}
                disabled={safePage === 0}
              >
                <Icon name="back" size={17} strokeWidth={2.2} /> Previous
              </button>
              <span className="dk-pager-count">
                {firstShown.toLocaleString()}–{lastShown.toLocaleString()} of {total.toLocaleString()}
              </span>
              <button
                type="button"
                className="dk-pager-btn"
                onClick={() => turn(Math.min(pages - 1, safePage + 1))}
                disabled={safePage >= pages - 1}
              >
                Next <Icon name="chevron" size={17} strokeWidth={2.2} />
              </button>
            </div>
          )}
        </div>
      </Band>
    </Page>
  )
}
