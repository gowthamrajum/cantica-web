import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Screen } from '../components/app/Screen'
import { Sheet } from '../components/app/Sheet'
import { Segmented } from '../components/app/Segmented'
import { Icon } from '../components/app/Icons'
import { resolveSong, type Song, type Stanza } from '../lib/songs'
import { READ_SIZES, usePref, useReadSize } from '../lib/prefs'

type SLang = 'both' | 'te' | 'en'
const LANGS: { id: SLang; label: string }[] = [
  { id: 'te', label: 'తెలుగు' },
  { id: 'en', label: 'English' },
  { id: 'both', label: 'Both' }
]

export function SongDetail(): JSX.Element {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [song, setSong] = useState<Song | null | undefined>(undefined)
  const [lang, setLang] = usePref<SLang>('tcc-song-lang', 'both')
  const [settings, setSettings] = useState(false)
  const read = useReadSize()

  useEffect(() => {
    let alive = true
    setSong(undefined)
    resolveSong(id)
      .then((found) => {
        if (!alive) return
        if (!found) {
          setSong(null)
          return
        }
        // A song has one address. Arrive by the old numeric id — a bookmark, a
        // link shared before this changed — and the URL is corrected under you,
        // with `replace` so Back still goes where it came from rather than
        // bouncing off the id and straight back here.
        if (found.slug !== id) navigate(`/songs/${found.slug}`, { replace: true })
        setSong(found.song)
      })
      .catch(() => alive && setSong(null))
    return () => {
      alive = false
    }
  }, [id, navigate])

  const stanzas = song?.stanzas ?? []
  // Loading and not-found are different answers and used to look identical: an
  // ellipsis that never resolved. Now that the URL carries a title, a mistyped
  // or stale one is a thing that will actually happen, and it has to say so.
  const heading = song ? song.song_name : song === null ? 'Song not found' : '…'

  return (
    <Screen
      variant="push"
      title={song ? song.song_name : song === null ? 'Song not found' : 'Song'}
      back={{ to: '/songs', label: 'Songs' }}
      trailing={
        <button type="button" className="icon-btn" onClick={() => setSettings(true)} aria-label="Reading settings">
          <Icon name="text" size={21} />
        </button>
      }
      hero={
        <div className="screen-hero">
          <span className="screen-eyebrow">Songbook · కీర్తన</span>
          <h1 className="screen-title">{heading}</h1>
          {song && (
            <p className="screen-sub">
              {song.main_stanza ? 'Pallavi · ' : ''}
              {stanzas.length} {stanzas.length === 1 ? 'stanza' : 'stanzas'}
            </p>
          )}
        </div>
      }
    >
      {song === undefined && (
        <div className="flex items-center justify-center gap-2.5 py-20 text-[15px] text-ink-muted">
          <span className="spinner" /> Loading…
        </div>
      )}
      {song === null && <p className="py-20 text-center text-[15px] text-ink-muted">Song not found.</p>}

      {song && (
        <div className="mt-2 space-y-3 px-[var(--gutter)]" style={{ '--read-size': `${read.size}px` } as CSSProperties}>
          {song.main_stanza && <Block label="Pallavi · పల్లవి" stanza={song.main_stanza} lang={lang} accent />}
          {stanzas.map((st, i) => (
            <Block key={i} label={`Stanza ${st.stanza_number ?? i + 1}`} stanza={st} lang={lang} />
          ))}
        </div>
      )}

      <Sheet open={settings} title="Reading" onClose={() => setSettings(false)}>
        <div className="px-[var(--gutter)]">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.13em] text-ink-muted">Language</p>
          <Segmented options={LANGS} value={lang} onChange={setLang} ariaLabel="Song language" />

          <p className="mb-2 mt-6 text-[12px] font-bold uppercase tracking-[0.13em] text-ink-muted">Text size</p>
          <div className="flex items-center gap-3 pb-3">
            <button
              type="button"
              onClick={read.dec}
              disabled={!read.canDec}
              className="btn-app btn-app-quiet h-11 w-14 flex-none disabled:opacity-40"
              aria-label="Smaller text"
            >
              <Icon name="minus" size={18} strokeWidth={2.4} />
            </button>
            <div className="flex flex-1 items-center justify-center gap-1">
              {READ_SIZES.map((_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= read.step ? 'bg-gold-500' : 'bg-line'}`} />
              ))}
            </div>
            <button
              type="button"
              onClick={read.inc}
              disabled={!read.canInc}
              className="btn-app btn-app-quiet h-11 w-14 flex-none disabled:opacity-40"
              aria-label="Larger text"
            >
              <Icon name="plus" size={18} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </Sheet>
    </Screen>
  )
}

/** One stanza as its own card, so a singer can track where they are at a glance. */
function Block({
  label,
  stanza,
  lang,
  accent = false
}: {
  label: string
  stanza: Stanza
  lang: SLang
  accent?: boolean
}): JSX.Element {
  const te = stanza.telugu ?? []
  const en = stanza.english ?? []
  const showTe = lang !== 'en' && te.length > 0
  const showEn = lang !== 'te' && en.length > 0

  return (
    <div className={`app-card mx-0 p-4 ${accent ? 'border-gold-200 bg-gold-50/40' : ''}`}>
      <div className="mb-2.5 text-[11.5px] font-bold uppercase tracking-[0.15em] text-gold-600">{label}</div>
      {showTe &&
        te.map((l, i) => (
          <div key={`t${i}`} className="verse-te font-medium text-ink">
            {l}
          </div>
        ))}
      {showEn && (
        <div className={showTe ? 'mt-2.5 border-t border-line/70 pt-2.5' : ''}>
          {en.map((l, i) => (
            <div key={`e${i}`} className="verse-en text-ink-soft">
              {l}
            </div>
          ))}
        </div>
      )}
      {!showTe && !showEn && <p className="text-[14px] italic text-ink-muted">Not available in this language.</p>}
    </div>
  )
}
