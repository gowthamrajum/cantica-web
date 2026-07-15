import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageBar } from '../components/PageBar'
import { Footer } from '../components/Footer'
import { listSongs, type SongMeta } from '../lib/songs'

const PAGE = 60

export function Songs(): JSX.Element {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [songs, setSongs] = useState<SongMeta[] | null>(null)
  const [error, setError] = useState(false)
  const [shown, setShown] = useState(PAGE)

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

  const visible = useMemo(() => songs?.slice(0, shown) ?? [], [songs, shown])

  return (
    <div className="flex min-h-svh flex-col">
      <PageBar />
      <main className="container-x flex-1 py-10 sm:py-14">
        <p className="eyebrow">Worship songbook · కీర్తనలు</p>
        <h1 className="mt-4 font-serif text-4xl font-semibold text-ink sm:text-5xl">Songs</h1>
        <p className="mt-3 text-lg text-ink-soft">{songs ? `${songs.length.toLocaleString()} songs` : 'Our worship songbook'}</p>

        <div className="sticky top-[calc(68px+env(safe-area-inset-top))] z-20 -mx-1 mb-6 mt-6 flex items-center gap-3 rounded-full border border-line bg-card px-4 py-3 shadow-soft">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-none text-ink-muted"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search songs…"
            className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-muted"
          />
        </div>

        {songs === null && !error && <p className="py-16 text-center text-ink-muted">Loading the songbook…</p>}
        {error && <p className="py-16 text-center text-ink-muted">Couldn’t load the songbook.</p>}
        {songs && songs.length === 0 && <p className="py-16 text-center text-ink-muted">No songs match “{debounced}”.</p>}

        {visible.length > 0 && (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((s) => (
              <Link
                key={s.song_id}
                to={`/songs/${s.song_id}`}
                className="card-classic flex items-center gap-3 px-4 py-3.5 transition hover:-translate-y-0.5 hover:border-gold-400 hover:shadow-lift"
              >
                <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-gold-50 font-serif text-sm font-bold text-gold-600">♪</span>
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{s.song_name}</span>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-none text-ink-muted"><path d="M9 6l6 6-6 6" /></svg>
              </Link>
            ))}
          </div>
        )}

        {songs && shown < songs.length && (
          <button
            onClick={() => setShown((n) => n + PAGE)}
            className="mx-auto mt-8 block rounded-full border border-line bg-card px-6 py-2.5 font-semibold text-navy-700 shadow-soft transition hover:border-gold-400"
          >
            Show more ({songs.length - shown} left)
          </button>
        )}
      </main>
      <Footer />
    </div>
  )
}
