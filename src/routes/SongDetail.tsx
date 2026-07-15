import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageBar } from '../components/PageBar'
import { getSong, type Song, type Stanza } from '../lib/songs'

type SLang = 'both' | 'te' | 'en'
const LANGS: { id: SLang; label: string }[] = [
  { id: 'both', label: 'Both' },
  { id: 'te', label: 'తెలుగు' },
  { id: 'en', label: 'English' }
]

export function SongDetail(): JSX.Element {
  const { id = '' } = useParams()
  const [song, setSong] = useState<Song | null | undefined>(undefined)
  const [lang, setLang] = useState<SLang>('both')

  useEffect(() => {
    let alive = true
    setSong(undefined)
    getSong(Number(id))
      .then((s) => alive && setSong(s ?? null))
      .catch(() => alive && setSong(null))
    return () => {
      alive = false
    }
  }, [id])

  return (
    <div className="flex min-h-svh flex-col">
      <PageBar />
      <main className="container-x flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-2xl">
          <Link to="/songs" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft transition hover:text-gold-600">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            All songs
          </Link>

          {song === undefined && <p className="py-20 text-center text-ink-muted">Loading…</p>}
          {song === null && <p className="py-20 text-center text-ink-muted">Song not found.</p>}

          {song && (
            <>
              <header className="mb-8 mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
                <h1 className="font-serif text-3xl font-semibold text-ink sm:text-4xl">{song.song_name}</h1>
                <div className="flex gap-1 rounded-full border border-line bg-card p-1 shadow-soft">
                  {LANGS.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setLang(l.id)}
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${lang === l.id ? 'bg-navy-700 text-paper' : 'text-ink-soft hover:text-gold-600'}`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </header>

              <div className="space-y-8">
                {song.main_stanza && <Block label="Pallavi · పల్లవి" stanza={song.main_stanza} lang={lang} />}
                {(song.stanzas ?? []).map((st, i) => (
                  <Block key={i} label={`Stanza ${st.stanza_number ?? i + 1}`} stanza={st} lang={lang} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function Block({ label, stanza, lang }: { label: string; stanza: Stanza; lang: SLang }): JSX.Element {
  const te = stanza.telugu ?? []
  const en = stanza.english ?? []
  const showTe = lang !== 'en'
  const showEn = lang !== 'te' && en.length > 0
  return (
    <div>
      <div className="mb-2.5 text-[12px] font-bold uppercase tracking-label text-gold-600">{label}</div>
      {showTe && te.map((l, i) => <div key={`t${i}`} className="text-[19px] font-medium leading-relaxed text-ink">{l}</div>)}
      {showEn && (
        <div className={showTe ? 'mt-2' : ''}>
          {en.map((l, i) => <div key={`e${i}`} className="text-[16px] leading-relaxed text-ink-soft">{l}</div>)}
        </div>
      )}
    </div>
  )
}
