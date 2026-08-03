import { useEffect, useMemo, useRef, useState } from 'react'
import { Screen, Section } from '../components/app/Screen'
import { Segmented } from '../components/app/Segmented'
import { Icon } from '../components/app/Icons'
import { SlidePreview } from '../components/app/SlidePreview'
import { SongStructureSheet } from '../components/app/SongStructureSheet'
import { ServiceSlotSheet } from '../components/app/ServiceSlotSheet'
import { ServiceExistsSheet } from '../components/app/ServiceExistsSheet'
import { ServicePickerSheet, type PickSource } from '../components/app/ServicePickerSheet'
import { ConfirmSheet } from '../components/app/ConfirmSheet'
import { SongRoleSheet, type Role } from '../components/app/SongRoleSheet'
import { getSong, type Song, type SongMeta } from '../lib/songs'
import { loadBible } from '../lib/bible'
import { createService, findService, getService, updateService } from '../lib/relay'
import { fromBuilderState, readBuilderState, toBuilderState } from '../lib/builderState'
import { daysPast, defaultSlot, isFirstSundayOfMonth, prettyDate, type ServiceSlot } from '../lib/serviceSlot'
import { buildServicePdf } from '../lib/servicePdf'
import { shareFiles } from '../lib/shareFiles'
import {
  buildService,
  countSlides,
  roleAlsoGeneral,
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

/** Short forms for the role chip on a picked song. */
const ROLE_LABEL: Record<string, string> = {
  general: 'General',
  offering: 'Offering only',
  'offering+general': 'General + offering',
  communion: 'Communion only',
  'communion+general': 'General + communion'
}

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

  // The relay row this builder is bound to. Set when this slot's service has
  // been loaded for editing, or when we've just saved into it — either way,
  // saving from here on is an edit of that row, not a new service.
  const [savedId, setSavedId] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)
  /** True once the loaded service's picks are in hand, so saves are edits. */
  const [editing, setEditing] = useState(false)

  // The "this slot is taken" prompt, raised when a slot is chosen (or when a
  // save races another caller to it).
  const [exists, setExists] = useState<{ id: number; detail: string; canLoad: boolean } | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)
  // Guards against a stale slot check landing after a newer one.
  const checkToken = useRef(0)

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
  /** A song already in the service, held while we ask whether to repeat it. */
  const [duplicate, setDuplicate] = useState<{ meta: SongMeta; at: number[] } | null>(null)
  /** Index of the pick whose arrangement is being reopened, if any. */
  const [editingPick, setEditingPick] = useState<number | null>(null)
  /** Index of the pick whose offering role is being chosen. */
  const [rolePick, setRolePick] = useState<number | null>(null)

  const beginSong = async (meta: SongMeta): Promise<void> => {
    setPickerOpen(false)
    const song = await getSong(meta.song_id)
    if (song) setPending(song)
  }

  /**
   * Adding the same song twice is occasionally deliberate (a reprise) and far
   * more often a slip, so it asks rather than either silently allowing or
   * silently refusing — and it says where the existing copies already sit.
   */
  const openSong = async (meta: SongMeta): Promise<void> => {
    const at = picks.reduce<number[]>((acc, p, i) => {
      if (p.type === 'song' && p.song.song_id === meta.song_id) acc.push(i + 1)
      return acc
    }, [])
    if (at.length) {
      setPickerOpen(false)
      setDuplicate({ meta, at })
      return
    }
    await beginSong(meta)
  }
  const addSong = (structure: SongStructure): void => {
    const song = pending
    if (!song) return
    setPending(null)
    // Reopened from the service list: replace that pick's arrangement in place
    // rather than appending the song a second time.
    if (editingPick !== null) {
      const i = editingPick
      setEditingPick(null)
      setPicks((p) => p.map((x, j) => (j === i && x.type === 'song' ? { ...x, structure } : x)))
      setNote(`Updated ${song.song_name}`)
      return
    }
    setPicks((p) => [...p, { key: `s-${song.song_id}-${p.length}`, type: 'song', song, lang, structure }])
    setNote(`Added ${song.song_name}`)
  }

  /** Reopen a picked song's arrangement for editing. */
  const editPick = (i: number): void => {
    const p = picks[i]
    if (p?.type !== 'song') return
    setEditingPick(i)
    setPending(p.song)
  }

  const setRoleAt = (i: number, role: Role): void =>
    setPicks((p) => p.map((x, j) => (j === i && x.type === 'song' ? { ...x, role } : x)))

  /** Communion is only served on the month's first Sunday. */
  const firstSunday = isFirstSundayOfMonth(slot.date)

  // Moving the service off a first Sunday leaves any communion role standing on
  // a service that has no communion, so those fall back to the worship set
  // rather than lingering as a choice the UI would no longer even offer.
  useEffect(() => {
    if (firstSunday) return
    setPicks((p) => {
      if (!p.some((x) => x.type === 'song' && x.role?.startsWith('communion'))) return p
      setNote('This service isn’t the month’s first Sunday, so communion songs became general songs.')
      return p.map((x) =>
        x.type === 'song' && x.role?.startsWith('communion') ? { ...x, role: undefined } : x
      )
    })
  }, [firstSunday])

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

  const envelope = useMemo(() => buildService(name, picks), [name, picks])
  // What gets stored: the deck Cantica reads, plus a record of how it was
  // assembled so this builder can reopen it. The exported FILE stays the plain
  // envelope — Cantica has no use for the sidecar.
  const payload = useMemo(
    () => ({ ...envelope, builder: toBuilderState(slot.day, slot.date, picks) }),
    [envelope, slot.day, slot.date, picks]
  )
  const slides = countSlides(envelope)
  const labelOf = (p: Pick): string =>
    p.type === 'song' ? p.song.song_name : `Psalm ${p.chapter}`

  /**
   * Share the service as two files: a PDF to read from, one item per page, and
   * the .cantica.json Cantica imports. The PDF is built by rendering and
   * capturing pages, so it takes a moment on a long service.
   */
  const [sharing, setSharing] = useState(false)
  const shareService = async (): Promise<void> => {
    if (!picks.length || sharing) return
    setSharing(true)
    setNote('Building the PDF…')
    try {
      // `name` already carries the day and the date, so it is the filename.
      const safe = name.replace(/[\\/:*?"<>|]+/g, ' ').trim()
      const json = new File([JSON.stringify(envelope, null, 2)], `${safe}.cantica.json`, {
        type: 'application/json'
      })
      const pdf = new File([await buildServicePdf(envelope, name)], `${safe}.pdf`, {
        type: 'application/pdf'
      })
      const outcome = await shareFiles([pdf, json], name, `${name} — ${picks.length} items`)
      setNote(
        outcome === 'shared'
          ? 'Shared the PDF and the Cantica file.'
          : outcome === 'cancelled'
            ? 'Sharing cancelled.'
            : 'Saved the PDF and the Cantica file. Import the .cantica.json via Sessions ▸ ⋯ ▸ Import service.'
      )
    } catch (e) {
      setNote(e instanceof Error ? `Couldn’t build the PDF: ${e.message}` : 'Couldn’t build the PDF.')
    } finally {
      setSharing(false)
    }
  }

  /** Read a stored service well enough to say what can be done with it. */
  const describeExisting = async (
    id: number,
    message?: string
  ): Promise<{ id: number; detail: string; canLoad: boolean }> => {
    const full = await getService(id)
    const state = full ? readBuilderState(full.serviceData) : null
    return {
      id,
      canLoad: !!state,
      detail:
        message ??
        (state
          ? `Saved with ${state.picks.length} item${state.picks.length === 1 ? '' : 's'}.`
          : 'This day and date already has a service saved.')
    }
  }

  /**
   * Find out whether a slot already holds a service, and say so immediately
   * when the user has just chosen it.
   *
   * Called explicitly rather than from an effect keyed on the slot: confirming
   * the pre-filled Sunday changes neither the day nor the date, so an effect
   * would never re-run and the user would build an entire service before
   * discovering the slot was taken.
   */
  const checkSlot = async (s: ServiceSlot, ask: boolean): Promise<void> => {
    // Monotonic token: a slow answer for an abandoned slot must not overwrite
    // the answer for the one now on screen.
    const token = ++checkToken.current
    setSavedId(null)
    setEditing(false)
    setExists(null)
    setChecking(true)
    try {
      const found = await findService(s.day, s.date)
      if (token !== checkToken.current) return
      setSavedId(found ? found.id : null)
      if (found && ask) {
        const described = await describeExisting(found.id)
        if (token !== checkToken.current) return
        setExists(described)
      }
    } finally {
      if (token === checkToken.current) setChecking(false)
    }
  }

  // The slot the builder opens on was chosen by nobody, so learn its state for
  // the button but don't interrupt with it before the user has said anything.
  useEffect(() => {
    void checkSlot(slot, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Reopen the builder on the service already filed under this slot. */
  const loadExisting = async (): Promise<void> => {
    if (!exists) return
    setLoadingExisting(true)
    try {
      const full = await getService(exists.id)
      const state = full ? readBuilderState(full.serviceData) : null
      if (!state) {
        setNote('That service couldn’t be reopened.')
        return
      }
      const { picks: restored, skipped } = await fromBuilderState(state)
      setPicks(restored)
      setSavedId(exists.id)
      setEditing(true)
      setExists(null)
      setNote(
        `Loaded ${restored.length} item${restored.length === 1 ? '' : 's'} — saving updates this service.` +
          (skipped ? ` ${skipped} item${skipped === 1 ? '' : 's'} could not be restored.` : '')
      )
    } finally {
      setLoadingExisting(false)
    }
  }

  /**
   * Save the deck under this slot.
   *
   * Editing a service that was loaded here is an update, no questions asked —
   * that decision was made when it was opened. A save into a slot we haven't
   * opened is a create, and if the slot turns out to be taken (someone else got
   * there first) it raises the same prompt the slot picker does rather than
   * overwriting a deck nobody asked us to touch.
   */
  const saveService = async (): Promise<void> => {
    if (!picks.length) return
    setSaving(true)
    setNote('')
    try {
      // The slot holds a service we never opened — never overwrite it silently,
      // ask whether to open it or move this one elsewhere.
      if (!editing && savedId !== null) {
        setExists(await describeExisting(savedId))
        return
      }

      const r = editing
        ? await updateService(savedId!, payload, { serviceDay: slot.day, serviceDate: slot.date })
        : await createService(slot.day, slot.date, payload)
      if (r.ok) {
        setSavedId(r.service.id)
        setEditing(true)
        setNote(`${editing ? 'Saved changes to' : 'Created'} ${slot.day} · ${prettyDate(slot.date)}.`)
      } else if ('conflict' in r) {
        // Someone claimed the slot between our check and this write.
        setExists(await describeExisting(r.conflict.existing.id, r.conflict.message))
      } else setNote(r.message)
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
            {/* The slot's state stays on screen, not only in a modal that can
                be dismissed — this is what tells you whether you're starting
                fresh or standing on an existing service. */}
            {checking ? (
              <span className="mt-1 block text-[12.5px] text-ink-muted">Checking this slot…</span>
            ) : editing ? (
              <span className="pill mt-1.5 bg-emerald-50 text-emerald-700">Editing the saved service</span>
            ) : savedId !== null ? (
              <span className="pill mt-1.5 bg-amber-100 text-amber-800">Already has a service</span>
            ) : (
              <span className="pill mt-1.5 bg-line/60 text-ink-muted">Free — no service yet</span>
            )}
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

                {/* Settings: variable width, and only a song has a role. */}
                <div className="flex w-full min-w-0 items-center gap-1.5">
                  <select
                    className="search-field flex-none px-2 text-[13px]"
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

                  {/* The role reads as symbols rather than a phrase: an offering
                      plate, a communion cup, and a note for the worship set —
                      two glyphs when the song is sung twice. The words stay on
                      the button's label for anyone who needs them. */}
                  {p.type === 'song' && (
                    <button
                      className={`flex flex-none items-center gap-1 rounded-full px-2.5 py-1.5 ${
                        p.role?.startsWith('communion')
                          ? 'bg-red-50 text-red-600'
                          : p.role
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-black/5 text-ink-muted'
                      }`}
                      onClick={() => setRolePick(i)}
                      title={ROLE_LABEL[p.role ?? 'general']}
                      aria-label={`When is this sung? Currently: ${ROLE_LABEL[p.role ?? 'general']}`}
                    >
                      {roleAlsoGeneral(p.role) && <Icon name="songs" size={17} strokeWidth={2} />}
                      {p.role?.startsWith('offering') && <Icon name="offering" size={17} strokeWidth={2} />}
                      {p.role?.startsWith('communion') && <Icon name="communion" size={17} strokeWidth={2} />}
                    </button>
                  )}
                </div>

                {/* Actions: five fixed slots on every row, right-aligned, so an
                    icon sits at the same place whether the item is a song or a
                    psalm. A psalm has no arrangement, so its gear slot is held
                    open rather than collapsed. */}
                <div className="flex w-full items-center justify-end gap-1.5">
                  <button
                    className={`icon-btn${p.type === 'song' ? '' : ' invisible'}`}
                    onClick={() => editPick(i)}
                    aria-label="Edit arrangement"
                    aria-hidden={p.type !== 'song'}
                    tabIndex={p.type === 'song' ? 0 : -1}
                    disabled={p.type !== 'song'}
                  >
                    <Icon name="gear" size={17} />
                  </button>
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
              ? 'Saving…'
              : checking
                ? 'Checking…'
                : editing
                  ? 'Save changes'
                  : `Create ${slot.day} service`}
          </button>
          {!saving && !checking && editing && (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
              Editing the service saved for {slot.day} · {prettyDate(slot.date)}.
            </p>
          )}
          {!saving && !checking && !editing && savedId !== null && (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
              {slot.day} · {prettyDate(slot.date)} already has a service — saving will ask whether to open it or pick
              another day.
            </p>
          )}
        </div>
        <div className="mt-2 flex gap-2 px-[var(--gutter)]">
          <button
            className="btn-app btn-app-quiet flex-1 text-[15px]"
            onClick={() => void shareService()}
            disabled={!picks.length || sharing}
          >
            {sharing ? 'Preparing…' : 'Share'}
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

      <ConfirmSheet
        open={duplicate !== null}
        title="Already in this service"
        message={
          duplicate && (
            <>
              <b className="text-ink">{duplicate.meta.song_name}</b> is already in this service at{' '}
              {duplicate.at.length === 1
                ? `position ${duplicate.at[0]}`
                : `positions ${duplicate.at.slice(0, -1).join(', ')} and ${duplicate.at[duplicate.at.length - 1]}`}
              . Add it again?
            </>
          )
        }
        confirmLabel="Add it again"
        cancelLabel="Don’t add"
        tone="warn"
        onCancel={() => {
          setDuplicate(null)
          setPickerOpen(true)
        }}
        onConfirm={() => {
          const meta = duplicate?.meta
          setDuplicate(null)
          if (meta) void beginSong(meta)
        }}
      />

      <ServicePickerSheet
        open={pickerOpen}
        source={source}
        onSourceChange={setSource}
        onClose={() => setPickerOpen(false)}
        onPickSong={(m) => void openSong(m)}
        onAddPsalm={addPsalm}
      />

      <ServiceExistsSheet
        open={exists !== null}
        slotLabel={`${slot.day} · ${prettyDate(slot.date)}`}
        detail={exists?.detail}
        canLoad={exists?.canLoad ?? false}
        busy={loadingExisting}
        onLoad={() => void loadExisting()}
        onNewSlot={() => {
          setExists(null)
          setSlotOpen(true)
        }}
        onDismiss={() => setExists(null)}
      />

      <ServiceSlotSheet
        open={slotOpen}
        slot={slot}
        onCancel={() => setSlotOpen(false)}
        onConfirm={(s) => {
          setSlot(s)
          setSlotOpen(false)
          // Always re-check, even when the slot is unchanged: this is the
          // moment the user committed to it, so it's the moment to say whether
          // it is already taken.
          void checkSlot(s, true)
        }}
      />

      <SongStructureSheet
        song={pending}
        lang={editingPick !== null ? (picks[editingPick] as Extract<Pick, { type: 'song' }>).lang : lang}
        initial={
          editingPick !== null
            ? ((picks[editingPick] as Extract<Pick, { type: 'song' }>).structure ?? null)
            : null
        }
        confirmVerb={editingPick !== null ? 'Save' : 'Add'}
        onCancel={() => {
          setPending(null)
          setEditingPick(null)
        }}
        onAdd={addSong}
      />

      <SongRoleSheet
        open={rolePick !== null}
        firstSunday={firstSunday}
        songName={
          rolePick !== null && picks[rolePick]?.type === 'song'
            ? (picks[rolePick] as Extract<Pick, { type: 'song' }>).song.song_name
            : ''
        }
        value={
          rolePick !== null && picks[rolePick]?.type === 'song'
            ? (picks[rolePick] as Extract<Pick, { type: 'song' }>).role
            : undefined
        }
        onChange={(role) => rolePick !== null && setRoleAt(rolePick, role)}
        onClose={() => setRolePick(null)}
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
