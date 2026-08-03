import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Screen } from '../components/app/Screen'
import { useScreenScroll } from '../components/app/screenScroll'
import { Icon } from '../components/app/Icons'
import { SearchField } from '../components/app/SearchField'
import { listSongs, type SongMeta } from '../lib/songs'

const PAGE = 80

export function Songs(): JSX.Element {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [songs, setSongs] = useState<SongMeta[] | null>(null)
  const [error, setError] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const scrollEl = useScreenScroll()
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    let alive = true
    setShown(PAGE)
    listSongs(debounced)
      .then((s) => alive && setSongs(s))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [debounced])

  // Infinite scroll — a "Show more" button is a website affordance; a list that
  // simply keeps going is the app one.
  useEffect(() => {
    const el = sentinel.current
    if (!el || !scrollEl || !songs || shown >= songs.length) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => n + PAGE)
      },
      { root: scrollEl, rootMargin: '600px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [scrollEl, songs, shown])

  const visible = useMemo(() => songs?.slice(0, shown) ?? [], [songs, shown])

  // Group into A/B/C-style sections by first character — the songbook is Telugu,
  // so the index letters are Telugu too, which is what a reader scans for.
  const sections = useMemo(() => {
    const out: { key: string; items: SongMeta[] }[] = []
    for (const s of visible) {
      const key = (s.song_name.trim()[0] ?? '·').toUpperCase()
      const last = out[out.length - 1]
      if (last && last.key === key) last.items.push(s)
      else out.push({ key, items: [s] })
    }
    return out
  }, [visible])

  return (
    <Screen
      title="Songs"
      eyebrow="Worship songbook · కీర్తనలు"
      subtitle={songs ? `${songs.length.toLocaleString()} songs, available offline` : 'Our worship songbook'}
      affix={
        <SearchField value={q} onChange={setQ} placeholder="Search songs…" ariaLabel="Search songs" />
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
          <div className="index-head">{sec.key}</div>
          <div className="list-group mt-2">
            {sec.items.map((s) => (
              <Link key={s.song_id} to={`/songs/${s.song_id}`} className="list-row has-ico">
                <span className="list-ico bg-gold-500 font-serif text-[15px] font-bold">♪</span>
                <span className="min-w-0 flex-1">
                  <span className="list-title block truncate">{s.song_name}</span>
                </span>
                <Icon name="chevron" size={17} className="list-chev" />
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div ref={sentinel} aria-hidden="true" />
      {songs && shown < songs.length && (
        <div className="flex justify-center py-6">
          <span className="spinner" />
        </div>
      )}
    </Screen>
  )
}
