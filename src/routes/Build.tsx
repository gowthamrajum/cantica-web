import { useEffect, useMemo, useState } from 'react'
import { Screen, Section } from '../components/app/Screen'
import { Segmented } from '../components/app/Segmented'
import { Icon } from '../components/app/Icons'
import { SlidePreview } from '../components/app/SlidePreview'
import { listSongs, getSong, type SongMeta } from '../lib/songs'
import { loadBible } from '../lib/bible'
import {
  buildService,
  countSlides,
  type Pick,
  type PsalmVerse,
  type ServiceLang
} from '../lib/buildService'

/**
 * Service Builder — assemble Sunday's songs and psalms on a phone and hand the
 * result to Cantica as a `cantica-service` file.
 *
 * Everything it needs is already bundled in this app (1,596 songs and both
 * bibles), so it works with no network and no backend — which is the point of
 * moving it here from Worship Ready.
 */

const LANGS: { id: ServiceLang; label: string }[] = [
  { id: 'both', label: 'Both' },
  { id: 'telugu', label: 'తెలుగు' },
  { id: 'english', label: 'English' }
]

export function Build(): JSX.Element {
  const [name, setName] = useState('Sunday Service')
  const [lang, setLang] = useState<ServiceLang>('both')
  const [picks, setPicks] = useState<Pick[]>([])
  const [source, setSource] = useState<'songs' | 'psalms'>('songs')
  const [preview, setPreview] = useState<number | 'all' | null>(null)
  const [note, setNote] = useState('')

  // ----- songs -----
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [results, setResults] = useState<SongMeta[]>([])
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200)
    return () => clearTimeout(t)
  }, [q])
  useEffect(() => {
    let alive = true
    if (source !== 'songs') return
    void listSongs(debounced).then((s) => alive && setResults(s.slice(0, 40)))
    return () => {
      alive = false
    }
  }, [debounced, source])

  const addSong = async (meta: SongMeta): Promise<void> => {
    const song = await getSong(meta.song_id)
    if (!song) return
    setPicks((p) => [...p, { key: `s-${meta.song_id}-${p.length}`, type: 'song', song, lang }])
    setNote(`Added ${meta.song_name}`)
  }

  // ----- psalms -----
  const [chapter, setChapter] = useState('23')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)

  const addPsalm = async (): Promise<void> => {
    const ch = Math.max(1, Math.min(150, Number(chapter) || 1))
    setBusy(true)
    try {
      const [te, en] = await Promise.all([loadBible('telugu'), loadBible('web')])
      const teV = te.byBook['Psalms']?.[ch] ?? []
      const enV = en.byBook['Psalms']?.[ch] ?? []
      const enByVerse = new Map(enV.map((v) => [v.verse, v.text]))
      let verses: PsalmVerse[] = teV.map((v) => ({
        verse: v.verse,
        telugu: v.text,
        english: enByVerse.get(v.verse) ?? ''
      }))
      const lo = Number(from)
      const hi = Number(to)
      if (from.trim() && to.trim()) {
        if (lo > hi) {
          setNote('First verse must not be after the last.')
          return
        }
        verses = verses.filter((v) => v.verse >= lo && v.verse <= hi)
      }
      if (!verses.length) {
        setNote('No verses for that reference.')
        return
      }
      setPicks((p) => [...p, { key: `p-${ch}-${p.length}`, type: 'psalm', chapter: ch, verses, lang }])
      setNote(`Added Psalm ${ch}${from && to ? `:${lo}-${hi}` : ''}`)
    } finally {
      setBusy(false)
    }
  }

  // ----- the picked list -----
  const removeAt = (i: number): void => setPicks((p) => p.filter((_, j) => j !== i))
  const moveAt = (i: number, dir: -1 | 1): void =>
    setPicks((p) => {
      const j = i + dir
      if (j < 0 || j >= p.length) return p
      const next = p.slice()
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const setLangAt = (i: number, l: ServiceLang): void =>
    setPicks((p) => p.map((x, j) => (j === i ? { ...x, lang: l } : x)))
  const toggleOffering = (i: number): void =>
    setPicks((p) =>
      p.map((x, j) => (j === i && x.type === 'song' ? { ...x, offering: !x.offering } : x))
    )

  const envelope = useMemo(() => buildService(name, picks), [name, picks])
  const slides = countSlides(envelope)
  const labelOf = (p: Pick): string =>
    p.type === 'song' ? p.song.song_name : `Psalm ${p.chapter}`

  const exportFile = (): void => {
    if (!picks.length) return
    const safe = (name || 'Sunday Service').replace(/[\\/:*?"<>|]+/g, ' ').trim()
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safe}.cantica.json`
    a.click()
    URL.revokeObjectURL(url)
    setNote('Downloaded — open it in Cantica via Sessions ▸ ⋯ ▸ Import service.')
  }

  return (
    <Screen title="Service Builder" subtitle="Pick Sunday's songs and readings, then hand them to Cantica.">
      <Section>
        <span className="list-label">Service name</span>
        <label className="search-field mt-1 mx-[var(--gutter)]">
          <Icon name="text" size={17} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sunday Service" />
        </label>
        <div className="mt-3">
          <span className="list-label">Language for new items</span>
          <Segmented options={LANGS} value={lang} onChange={setLang} ariaLabel="Lyric language" />
        </div>
      </Section>

      <Section>
        <Segmented
          options={[
            { id: 'songs', label: 'Songs' },
            { id: 'psalms', label: 'Psalms' }
          ]}
          value={source}
          onChange={setSource}
          ariaLabel="What to add"
        />

        {source === 'songs' ? (
          <>
            <label className="search-field mt-3 mx-[var(--gutter)]">
              <Icon name="search" size={18} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 1,596 songs" />
            </label>
            <div className="list-group mt-2 max-h-72 overflow-auto">
              {results.map((s) => (
                <button
                  key={s.song_id}
                  className="list-row w-full text-left"
                  onClick={() => void addSong(s)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="list-title block truncate">{s.song_name}</span>
                  </span>
                  <Icon name="plus" size={18} className="list-chev" />
                </button>
              ))}
              {results.length === 0 && <div className="px-4 py-3 text-[14px] text-ink-muted">No matches.</div>}
            </div>
          </>
        ) : (
          <div className="mt-3 px-[var(--gutter)]">
            <div className="grid grid-cols-3 gap-2">
              <label className="min-w-0">
                <span className="list-label">Psalm</span>
                <span className="search-field mt-1">
                  <input inputMode="numeric" value={chapter} onChange={(e) => setChapter(e.target.value)} />
                </span>
              </label>
              <label className="min-w-0">
                <span className="list-label">From</span>
                <span className="search-field mt-1">
                  <input inputMode="numeric" value={from} placeholder="all" onChange={(e) => setFrom(e.target.value)} />
                </span>
              </label>
              <label className="min-w-0">
                <span className="list-label">To</span>
                <span className="search-field mt-1">
                  <input inputMode="numeric" value={to} placeholder="all" onChange={(e) => setTo(e.target.value)} />
                </span>
              </label>
            </div>
            <button className="btn-app btn-app-primary btn-block mt-3" onClick={() => void addPsalm()} disabled={busy}>
              Add psalm
            </button>
          </div>
        )}
      </Section>

      <Section>
        <div className="flex items-baseline gap-2 px-[var(--gutter)]">
          <span className="list-label">Service</span>
          <span className="text-[12px] text-ink-muted">
            {envelope.service.items.length} item{envelope.service.items.length === 1 ? '' : 's'} · {slides} slide
            {slides === 1 ? '' : 's'}
          </span>
        </div>

        {picks.length === 0 ? (
          <p className="mt-2 px-[var(--gutter)] text-[15px] text-ink-muted">Nothing picked yet.</p>
        ) : (
          <div className="list-group mt-2">
            {picks.map((p, i) => (
              <div key={p.key} className="list-row flex-col !items-start gap-2 text-left">
                <span className="min-w-0">
                  <span className="list-title block">
                    {i + 1}. {labelOf(p)}
                  </span>
                  <span className="list-sub block">
                    {p.type === 'song' ? 'Song' : 'Responsive reading'}
                  </span>
                </span>

                <div className="flex items-center gap-1.5">
                <select
                  className="search-field px-2 text-[13px]"
                  value={p.lang}
                  onChange={(e) => setLangAt(i, e.target.value as ServiceLang)}
                  aria-label="Language"
                >
                  {LANGS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>

                {p.type === 'song' && (
                  <button
                    className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${
                      p.offering ? 'bg-amber-100 text-amber-700' : 'bg-black/5 text-ink-muted'
                    }`}
                    onClick={() => toggleOffering(i)}
                    title="Cantica puts the offering song at Offerings"
                  >
                    Offering
                  </button>
                )}
                <button className="icon-btn" onClick={() => setPreview(i)} aria-label="Preview">
                  <Icon name="eye" size={17} />
                </button>
                <button className="icon-btn" onClick={() => moveAt(i, -1)} disabled={i === 0} aria-label="Move up">
                  <Icon name="chevron" size={17} className="-rotate-90" />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => moveAt(i, 1)}
                  disabled={i === picks.length - 1}
                  aria-label="Move down"
                >
                  <Icon name="chevron" size={17} className="rotate-90" />
                </button>
                <button className="icon-btn" onClick={() => removeAt(i)} aria-label="Remove">
                  <Icon name="close" size={17} />
                </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex gap-2 px-[var(--gutter)]">
          <button className="btn-app btn-app-primary flex-1 text-[15px]" onClick={exportFile} disabled={!picks.length}>
            Export for Cantica
          </button>
          <button className="btn-app btn-app-quiet flex-1 text-[15px]" onClick={() => setPreview('all')} disabled={!picks.length}>
            Preview
          </button>
        </div>
        {note && <p className="mt-2 px-[var(--gutter)] text-[13px] text-ink-muted">{note}</p>}

        <p className="mt-4 px-[var(--gutter)] text-[13px] leading-relaxed text-ink-muted">
          <b>In Cantica:</b> Sessions ▸ ⋯ ▸ <i>Import service (JSON / ZIP)</i>. Songs keep each Telugu line
          with its transliteration on the same slide, exactly as Cantica splits them.
        </p>
      </Section>

      <SlidePreview
        open={preview !== null}
        envelope={
          preview === null
            ? null
            : preview === 'all'
              ? envelope
              : buildService(name, [picks[preview]])
        }
        title={preview === null || preview === 'all' ? 'Preview' : labelOf(picks[preview])}
        onClose={() => setPreview(null)}
      />
    </Screen>
  )
}
