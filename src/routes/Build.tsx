import { useEffect, useMemo, useState } from 'react'
import { Screen, Section } from '../components/app/Screen'
import { Segmented } from '../components/app/Segmented'
import { Icon } from '../components/app/Icons'
import { SlidePreview } from '../components/app/SlidePreview'
import { SongStructureSheet } from '../components/app/SongStructureSheet'
import { ServiceSlotSheet } from '../components/app/ServiceSlotSheet'
import { ServiceConflictSheet } from '../components/app/ServiceConflictSheet'
import { ServicePickerSheet, type PickSource } from '../components/app/ServicePickerSheet'
import { getSong, type Song, type SongMeta } from '../lib/songs'
import { loadBible } from '../lib/bible'
import { createService, findService, updateService } from '../lib/relay'
import { daysPast, defaultSlot, prettyDate, type ServiceSlot } from '../lib/serviceSlot'
import {
  buildService,
  countSlides,
  type Pick,
  type PsalmVerse,
  type ServiceLang,
  type SongStructure
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
  // The slot comes first: the builder opens on this sheet, and everything picked
  // afterwards is filed under the day and date it settles.
  const [slot, setSlot] = useState<ServiceSlot>(defaultSlot)
  const [slotOpen, setSlotOpen] = useState(true)

  // The day and date ARE the service's identity — the relay keys on them and one
  // service exists per slot — so there's nothing for a separate name to add.
  // Cantica still wants a session title on import, so it's derived here, in the
  // same shape as the exports Cantica already writes ("Sunday Service · August
  // 9, 2026") rather than asked for.
  const name = `${slot.day} Service · ${prettyDate(slot.date)}`

  const [saving, setSaving] = useState(false)
  /** The stored service standing in this slot's way, once a save has hit it. */
  const [clash, setClash] = useState<{ id: number; message: string } | null>(null)

  // The relay row this builder is bound to, if this slot is already filed.
  // Knowing it up front turns the second save of a slot into a plain update
  // instead of a create that has to be rejected and recovered from.
  const [savedId, setSavedId] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)

  const [lang, setLang] = useState<ServiceLang>('both')
  const [picks, setPicks] = useState<Pick[]>([])
  const [source, setSource] = useState<PickSource>('songs')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [preview, setPreview] = useState<number | 'all' | null>(null)
  const [note, setNote] = useState('')

  const openPicker = (s: PickSource): void => {
    setSource(s)
    setPickerOpen(true)
  }

  // A song is arranged before it lands: which stanzas play, and which repeats.
  // Picking one closes the picker so the structure sheet has the screen to
  // itself rather than stacking two modals.
  const [pending, setPending] = useState<Song | null>(null)
  const openSong = async (meta: SongMeta): Promise<void> => {
    setPickerOpen(false)
    const song = await getSong(meta.song_id)
    if (song) setPending(song)
  }
  const addSong = (structure: SongStructure): void => {
    const song = pending
    if (!song) return
    setPending(null)
    setPicks((p) => [...p, { key: `s-${song.song_id}-${p.length}`, type: 'song', song, lang, structure }])
    setNote(`Added ${song.song_name}`)
  }

  // ----- psalms -----
  // Returns whether it landed, so the picker knows whether to close.
  const addPsalm = async (chapter: string, from: string, to: string): Promise<boolean> => {
    const ch = Math.max(1, Math.min(150, Number(chapter) || 1))
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
        return false
      }
      verses = verses.filter((v) => v.verse >= lo && v.verse <= hi)
    }
    if (!verses.length) {
      setNote('No verses for that reference.')
      return false
    }
    setPicks((p) => [...p, { key: `p-${ch}-${p.length}`, type: 'psalm', chapter: ch, verses, lang }])
    setNote(`Added Psalm ${ch}${from && to ? `:${lo}-${hi}` : ''}`)
    return true
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
    // `name` already carries the day and the date, so it is the filename.
    const safe = name.replace(/[\\/:*?"<>|]+/g, ' ').trim()
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safe}.cantica.json`
    a.click()
    URL.revokeObjectURL(url)
    setNote('Downloaded — open it in Cantica via Sessions ▸ ⋯ ▸ Import service.')
  }

  // Ask the store whether this slot is taken as soon as it's chosen, so the
  // button can say "Update" before you press it rather than after.
  useEffect(() => {
    let alive = true
    setSavedId(null)
    setClash(null)
    setChecking(true)
    void findService(slot.day, slot.date)
      .then((s) => {
        if (!alive) return
        setSavedId(s ? s.id : null)
      })
      .finally(() => alive && setChecking(false))
    return () => {
      alive = false
    }
  }, [slot.day, slot.date])

  // Save the deck under this slot. The store holds one service per (date, day),
  // so a slot that's already filed never gets overwritten on a single tap — it
  // raises the conflict sheet and waits to be told which way to go.
  const saveService = async (): Promise<void> => {
    if (!picks.length) return
    if (savedId !== null) {
      setClash({
        id: savedId,
        message: `A service is already saved for this day and date. Continuing replaces it.`
      })
      return
    }
    setSaving(true)
    setNote('')
    try {
      const r = await createService(slot.day, slot.date, envelope)
      if (r.ok) {
        setSavedId(r.service.id)
        setNote(`Saved ${slot.day} · ${prettyDate(slot.date)} to the service store.`)
      } else if ('conflict' in r) {
        // Someone claimed the slot between our check and this write.
        setClash({ id: r.conflict.existing.id, message: r.conflict.message })
      } else setNote(r.message)
    } finally {
      setSaving(false)
    }
  }

  /** "Continue with new service" — push this deck over the stored one. */
  const continueWithNew = async (): Promise<void> => {
    if (!clash) return
    setSaving(true)
    try {
      const r = await updateService(clash.id, envelope, { serviceDay: slot.day, serviceDate: slot.date })
      if (r.ok) {
        setClash(null)
        setSavedId(r.service.id)
        setNote(`Replaced the service for ${slot.day} · ${prettyDate(slot.date)}.`)
      } else if ('conflict' in r) {
        setClash({ id: clash.id, message: r.conflict.message })
      } else {
        setClash(null)
        setNote(r.message)
      }
    } finally {
      setSaving(false)
    }
  }

  // The relay purges a service once its date is more than a week past.
  const stale = daysPast(slot.date) > 7

  return (
    <Screen title="Service Builder" subtitle="Say when the service is, pick its songs and readings, then save it.">
      <Section>
        <span className="list-label">When</span>
        <button
          type="button"
          onClick={() => setSlotOpen(true)}
          className="app-card pressable mt-1 flex w-full items-center gap-3 p-4 text-left"
        >
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-navy-700 text-gold-300">
            <Icon name="calendar" size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="list-title block">{slot.day}</span>
            <span className="list-sub block">{prettyDate(slot.date)}</span>
          </span>
          <Icon name="chevron" size={17} className="list-chev" />
        </button>
        {stale && (
          <p className="mt-2 px-[var(--gutter)] text-[13px] leading-relaxed text-amber-700">
            That date is over a week past — the service store purges services more than 7 days old, so this one may
            not survive. You can still export the file.
          </p>
        )}

        <div className="mt-3">
          <span className="list-label">Language for new items</span>
          <Segmented options={LANGS} value={lang} onChange={setLang} ariaLabel="Lyric language" />
        </div>
      </Section>

      <Section>
        <span className="list-label">Add to service</span>
        <div className="mt-1 grid grid-cols-2 gap-3 px-[var(--gutter)]">
          <button type="button" className="tile" onClick={() => openPicker('songs')}>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold-500 text-white">
              <Icon name="songs" size={20} strokeWidth={2} />
            </span>
            <span>
              <span className="block font-serif text-[17px] font-semibold text-ink">Songs</span>
              <span className="mt-0.5 block text-[13px] text-ink-muted">Search the songbook</span>
            </span>
          </button>
          <button type="button" className="tile" onClick={() => openPicker('psalms')}>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy-700 text-white">
              <Icon name="bible" size={20} strokeWidth={2} />
            </span>
            <span>
              <span className="block font-serif text-[17px] font-semibold text-ink">Psalms</span>
              <span className="mt-0.5 block text-[13px] text-ink-muted">Responsive reading</span>
            </span>
          </button>
        </div>
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

        <div className="mt-3 px-[var(--gutter)]">
          <button
            className="btn-app btn-app-primary btn-block"
            onClick={() => void saveService()}
            disabled={!picks.length || saving || checking}
          >
            {saving
              ? savedId
                ? 'Updating…'
                : 'Saving…'
              : checking
                ? 'Checking…'
                : savedId
                  ? `Update ${slot.day} service`
                  : `Create ${slot.day} service`}
          </button>
          {savedId !== null && !saving && (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
              A service is already filed for {slot.day} · {prettyDate(slot.date)} — saving replaces it. Pick another
              day or date to file a second one.
            </p>
          )}
        </div>
        <div className="mt-2 flex gap-2 px-[var(--gutter)]">
          <button className="btn-app btn-app-quiet flex-1 text-[15px]" onClick={exportFile} disabled={!picks.length}>
            Export file
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

      <ServicePickerSheet
        open={pickerOpen}
        source={source}
        onSourceChange={setSource}
        onClose={() => setPickerOpen(false)}
        onPickSong={(m) => void openSong(m)}
        onAddPsalm={addPsalm}
      />

      <ServiceConflictSheet
        open={clash !== null}
        message={clash?.message ?? ''}
        slotLabel={`${slot.day} · ${prettyDate(slot.date)}`}
        saving={saving}
        onEdit={() => {
          setClash(null)
          setNote('Nothing saved — the service already stored is untouched.')
        }}
        onContinue={() => void continueWithNew()}
      />

      <ServiceSlotSheet
        open={slotOpen}
        slot={slot}
        onCancel={() => setSlotOpen(false)}
        onConfirm={(s) => {
          setSlot(s)
          setSlotOpen(false)
          // A new slot invalidates a clash raised against the old one; the
          // slot-change effect re-checks the store and clears it too.
          setClash(null)
        }}
      />

      <SongStructureSheet
        song={pending}
        lang={lang}
        onCancel={() => setPending(null)}
        onAdd={addSong}
      />

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
