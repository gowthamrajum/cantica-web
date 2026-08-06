import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen, Section } from '../components/app/Screen'
import { Segmented } from '../components/app/Segmented'
import { Icon } from '../components/app/Icons'
import { SlidePreview } from '../components/app/SlidePreview'
import { SongStructureSheet } from '../components/app/SongStructureSheet'
import { ServiceSlotSheet } from '../components/app/ServiceSlotSheet'
import { ServiceExistsSheet } from '../components/app/ServiceExistsSheet'
import { ServicePickerSheet, type PickSource } from '../components/app/ServicePickerSheet'
import { SavedServicesSheet } from '../components/app/SavedServicesSheet'
import { SavedServiceView } from '../components/app/SavedServiceView'
import { ServiceLinksEditor } from '../components/app/ServiceLinksEditor'
import { usableLinks, type ServiceLink } from '../lib/links'
import { ConfirmSheet } from '../components/app/ConfirmSheet'
import { Sheet } from '../components/app/Sheet'
import { PsalmFields } from '../components/app/PsalmFields'
import { Collapsible } from '../components/app/Collapsible'
import { useDisclosure } from '../components/app/useDisclosure'
import { SongRoleSheet, type Role } from '../components/app/SongRoleSheet'
import { getSong, type Song, type SongMeta } from '../lib/songs'
import { loadBible } from '../lib/bible'
import { createService, findService, getService, updateService } from '../lib/relay'
import { readEnvelope } from '../lib/livecast'
import { picksFromDeck } from '../lib/deckToPicks'
import { fromBuilderState, isFromPresenter, readBuilderState, toBuilderState } from '../lib/builderState'
import {
  DAYS,
  dayOf,
  daysPast,
  defaultSlot,
  isFirstSundayOfMonth,
  prettyDate,
  shortDate,
  type ServiceSlot
} from '../lib/serviceSlot'
import { buildServicePdf } from '../lib/servicePdf'
import { shareFiles } from '../lib/shareFiles'
import {
  buildService,
  countSlides,
  roleAlsoGeneral,
  type Pick,
  type PsalmVerse,
  type ServiceEnvelope,
  type ServiceLang,
  type SongStructure
} from '../lib/buildService'

/**
 * Service Builder — assemble Sunday's songs and psalms on a phone and hand the
 * result to Cantica as a `cantica-service` file.
 *
 * Everything it needs is already bundled in this app (the whole songbook and
 * both bibles), so it works with no network and no backend — which is the point
 * of moving it here from Worship Ready.
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
  const navigate = useNavigate()
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
  const [exists, setExists] = useState<{
    id: number
    detail: string
    canLoad: boolean
    canView: boolean
  } | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)
  // Guards against a stale slot check landing after a newer one.
  const checkToken = useRef(0)

  // The "open a saved service" list, and the service it opened for reading.
  // Only a service carrying a builder sidecar can come back as picks; one built
  // on the presenter is a finished deck and opens as itself — see
  // SavedServiceView for why rebuilding it would be a guess.
  const [savedOpen, setSavedOpen] = useState(false)
  const [openingId, setOpeningId] = useState<number | null>(null)
  const [viewing, setViewing] = useState<{
    id: number
    day: string
    date: string
    envelope: ServiceEnvelope
    origin: 'presenter' | 'unknown'
  } | null>(null)
  /** Which of the read-only service's items is being previewed. */
  const [viewPreview, setViewPreview] = useState<number | 'all' | null>(null)
  /**
   * A recovered deck waiting on "yes, edit it here".
   *
   * Held rather than applied because the answer costs something: the songs come
   * back without their arrangement and everything that isn't a song doesn't come
   * back at all, so saving afterwards replaces the presenter's order with this.
   * That is a decision, and it is made against the actual list of what leaves.
   */
  const [rebuild, setRebuild] = useState<{
    id: number
    day: string
    date: string
    picks: Pick[]
    dropped: { title: string; reason: string }[]
    links: ServiceLink[]
  } | null>(null)
  const [rebuilding, setRebuilding] = useState(false)

  const [lang, setLang] = useState<ServiceLang>('both')
  const [picks, setPicks] = useState<Pick[]>([])
  /** Where this service can be watched or joined — saved with the deck. */
  const [links, setLinks] = useState<ServiceLink[]>([])
  const [source, setSource] = useState<PickSource>('songs')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [preview, setPreview] = useState<number | 'all' | null>(null)
  const [note, setNote] = useState('')
  // Sections and items are closed by default; the setup opens on a fresh
  // service because there is nothing else to look at yet.
  // "When" opens by default; items start closed, which is what keeps a long
  // service readable on a phone.
  const disc = useDisclosure(['when'])

  const openPicker = (s: PickSource): void => {
    setSource(s)
    setPickerOpen(true)
  }

  /** Guards the picker against reopening on a tab that no longer exists. */
  const pickerSource = (): PickSource => (hasPsalm ? 'songs' : source)

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

  /** A psalm being changed: which pick, and the reference to seed the sheet. */
  const [editingPsalm, setEditingPsalm] = useState<
    { at: number; chapter: number; from?: number; to?: number } | null
  >(null)

  /** Reopen a picked item for editing — its arrangement, or its reference. */
  const editPick = (i: number): void => {
    const p = picks[i]
    if (!p) return
    if (p.type === 'song') {
      setEditingPick(i)
      setPending(p.song)
      return
    }
    // The pick keeps resolved verses, not the range that produced them; the
    // ends of the list are that range.
    setEditingPsalm({
      at: i,
      chapter: p.chapter,
      from: p.verses[0]?.verse,
      to: p.verses[p.verses.length - 1]?.verse
    })
  }

  const setRoleAt = (i: number, role: Role): void =>
    setPicks((p) => p.map((x, j) => (j === i && x.type === 'song' ? { ...x, role } : x)))

  /**
   * A service takes one responsive reading, so once a psalm is placed the way
   * to add another is withdrawn rather than left to be refused later.
   */
  const hasPsalm = picks.some((p) => p.type === 'psalm')

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
  const addPsalm = async (
    chapter: string,
    from: string,
    to: string,
    replaceAt?: number
  ): Promise<boolean> => {
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
    const ref = `Psalm ${ch}${from && to ? `:${lo}-${hi}` : ''}`
    if (replaceAt != null) {
      const at = replaceAt
      setPicks((p) =>
        p.map((x, j) => (j === at ? { ...x, type: 'psalm', chapter: ch, verses, lang: x.lang } : x))
      )
      setNote(`Changed to ${ref}`)
      return true
    }
    setPicks((p) => [...p, { key: `p-${ch}-${p.length}`, type: 'psalm', chapter: ch, verses, lang }])
    setNote(`Added ${ref}`)
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

  const envelope = useMemo(() => buildService(name, picks, links), [name, picks, links])
  // What gets stored: the deck Cantica reads, plus a record of how it was
  // assembled so this builder can reopen it. The exported FILE stays the plain
  // envelope — Cantica has no use for the sidecar.
  const builderState = useMemo(
    () => toBuilderState(slot.day, slot.date, picks, links),
    [slot.day, slot.date, picks, links]
  )
  const payload = useMemo(() => ({ ...envelope, builder: builderState }), [envelope, builderState])

  /**
   * What was last written to (or read from) the store, so "Save changes" can
   * tell whether there is anything to save.
   *
   * The comparison is against the BUILDER state, not the payload: the envelope
   * carries an exportedAt stamped at build time, so comparing payloads would
   * report a change on every render.
   */
  const stateKey = useMemo(() => JSON.stringify(builderState), [builderState])
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const dirty = savedKey === null || stateKey !== savedKey
  /**
   * Whether the service on screen is exactly the one in the store.
   *
   * Sharing and broadcasting both hand this service to other people — a PDF that
   * gets printed and read from a stand, a room the church watches — so both work
   * from what was SAVED. Letting them run on unsaved edits produces a sheet, or
   * a live service, that no longer matches anything anyone can reopen.
   */
  const committed = picks.length > 0 && savedId !== null && !dirty
  const slides = countSlides(envelope)
  const labelOf = (p: Pick): string =>
    p.type === 'song' ? p.song.song_name : `Psalm ${p.chapter}`

  /**
   * Share the service as two files: a PDF to read from, one item per page, and
   * the .cantica.json Cantica imports. The PDF is built by rendering and
   * capturing pages, so it takes a moment on a long service.
   */
  const [sharing, setSharing] = useState(false)
  /** Share any built envelope under a given name — the one being assembled, or
   *  one only being read. */
  const shareEnvelope = async (env: ServiceEnvelope, label: string): Promise<void> => {
    if (sharing) return
    setSharing(true)
    setNote('Building the PDF…')
    try {
      // The label already carries the day and the date, so it is the filename.
      const safe = label.replace(/[\\/:*?"<>|]+/g, ' ').trim()
      const json = new File([JSON.stringify(env, null, 2)], `${safe}.cantica.json`, {
        type: 'application/json'
      })
      const pdf = new File([await buildServicePdf(env, label)], `${safe}.pdf`, {
        type: 'application/pdf'
      })
      const count = env.service.items.length
      const outcome = await shareFiles([pdf, json], label, `${label} — ${count} items`)
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

  /** The service being assembled — shareable only once it has been saved. */
  const shareService = (): void => {
    if (!committed) return
    void shareEnvelope(envelope, name)
  }

  /**
   * Read a stored service well enough to say what can be done with it.
   *
   * Three answers, not two. It can be reopened as picks; or it can only be read
   * — which is the presenter's own orders, and used to be reported as "saved
   * before editing was supported", sending someone off to build a second
   * service for a Sunday that already had one; or it can't be read at all.
   */
  const describeExisting = async (
    id: number,
    message?: string
  ): Promise<{ id: number; detail: string; canLoad: boolean; canView: boolean }> => {
    const full = await getService(id)
    const state = full ? readBuilderState(full.serviceData) : null
    const env = !state && full ? readEnvelope(full.serviceData) : null
    const presenter = !!full && isFromPresenter(full.serviceData)
    return {
      id,
      canLoad: !!state,
      canView: !!env,
      detail:
        message ??
        (state
          ? `Saved with ${state.picks.length} item${state.picks.length === 1 ? '' : 's'}.`
          : env
            ? `${presenter ? 'Built on the presenter' : 'Saved without an arrangement'} — ${
                env.service.items.length
              } item${env.service.items.length === 1 ? '' : 's'}.`
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
    setSavedKey(null)
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
      const restoredLinks = state.links ?? []
      setPicks(restored)
      setLinks(restoredLinks)
      // The baseline is what the RESTORED picks produce, not the stored
      // sidecar: a psalm's range is re-derived from its verses, so the two can
      // differ harmlessly and would otherwise read as an unsaved change.
      setSavedKey(JSON.stringify(toBuilderState(slot.day, slot.date, restored, restoredLinks)))
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
   * Open any service in the store, from any day.
   *
   * Two things can come back. One this builder saved carries a record of how it
   * was assembled, so it reopens as picks and the builder moves onto its slot —
   * the same thing loadExisting does, reached from the list rather than from the
   * slot. One the presenter published carries no such record, so it opens for
   * reading: SavedServiceView says what that means and why.
   */
  const openSaved = async (s: { id: number; serviceDay: string; serviceDate: string }): Promise<void> => {
    setOpeningId(s.id)
    try {
      const full = await getService(s.id)
      if (!full) {
        setNote('That service couldn’t be opened.')
        return
      }
      const state = readBuilderState(full.serviceData)
      if (state) {
        const { picks: restored, skipped } = await fromBuilderState(state)
        const restoredLinks = state.links ?? []
        // serviceDay is free text on the relay — anything could have written it.
        // A slot the picker cannot represent would strand the builder on a day
        // it can't show, so fall back to the weekday the date actually is.
        const day = (DAYS as readonly string[]).includes(s.serviceDay)
          ? (s.serviceDay as ServiceSlot['day'])
          : dayOf(s.serviceDate) ?? slot.day
        const next = { day, date: s.serviceDate }
        // Everything about the slot moves together: a load that changed the
        // picks but left the builder pointing at last week would save Sunday's
        // service onto the wrong date.
        checkToken.current++
        setViewing(null)
        setSlot(next)
        setPicks(restored)
        setLinks(restoredLinks)
        setSavedKey(JSON.stringify(toBuilderState(next.day, next.date, restored, restoredLinks)))
        setSavedId(s.id)
        setEditing(true)
        setExists(null)
        setSavedOpen(false)
        setNote(
          `Loaded ${restored.length} item${restored.length === 1 ? '' : 's'} from ${s.serviceDay} · ${prettyDate(
            s.serviceDate
          )} — saving updates this service.` +
            (skipped ? ` ${skipped} item${skipped === 1 ? '' : 's'} could not be restored.` : '')
        )
        return
      }
      const env = readEnvelope(full.serviceData)
      if (!env) {
        setNote('That service couldn’t be read.')
        return
      }
      setViewing({
        id: s.id,
        day: s.serviceDay,
        date: s.serviceDate,
        envelope: env,
        origin: isFromPresenter(full.serviceData) ? 'presenter' : 'unknown'
      })
      setSavedOpen(false)
      setNote('')
    } finally {
      setOpeningId(null)
    }
  }

  /**
   * Work a finished deck back into picks, and ask before adopting them.
   *
   * This is the answer to "Load it and make edits" on a service that wasn't
   * assembled here. It can find the songs — a deck still names them — but not
   * how they were arranged, and not the welcome cards, countdown or sermon
   * around them. So it reports before it replaces.
   */
  const offerRebuild = async (s: { id: number; serviceDay: string; serviceDate: string }): Promise<void> => {
    setRebuilding(true)
    try {
      const full = await getService(s.id)
      const env = full ? readEnvelope(full.serviceData) : null
      if (!env) {
        setNote('That service couldn’t be read.')
        return
      }
      const { picks: found, dropped } = await picksFromDeck(env)
      if (!found.length) {
        setNote(
          `None of the ${env.service.items.length} items in that service matched a song or psalm here, so there is nothing to edit.`
        )
        return
      }
      setExists(null)
      setRebuild({
        id: s.id,
        day: s.serviceDay,
        date: s.serviceDate,
        picks: found,
        dropped,
        // A deck may carry links even when it carries no picks; they survive
        // verbatim, being the one part of it this builder can hold unchanged.
        links: usableLinks(env.service.links)
      })
    } finally {
      setRebuilding(false)
    }
  }

  /** Adopt the recovered picks — the builder now edits that service. */
  const adoptRebuild = (): void => {
    if (!rebuild) return
    const day = (DAYS as readonly string[]).includes(rebuild.day)
      ? (rebuild.day as ServiceSlot['day'])
      : dayOf(rebuild.date) ?? slot.day
    const next = { day, date: rebuild.date }
    checkToken.current++
    setViewing(null)
    setSlot(next)
    setPicks(rebuild.picks)
    setLinks(rebuild.links)
    setSavedId(rebuild.id)
    setEditing(true)
    // Deliberately NOT marking this as saved: what is on screen is a rebuild,
    // and it differs from the deck in the store. Leaving it dirty is what makes
    // "Save changes" live, and stops Share or Broadcast handing anyone a service
    // that matches nothing anybody can reopen.
    setSavedKey(null)
    setSavedOpen(false)
    const n = rebuild.dropped.length
    setNote(
      `Rebuilt ${rebuild.picks.length} item${rebuild.picks.length === 1 ? '' : 's'} from ${rebuild.day} · ${prettyDate(
        rebuild.date
      )}. Songs are in written order — set their arrangements, then save.` +
        (n ? ` ${n} item${n === 1 ? '' : 's'} couldn’t be rebuilt and will not survive the save.` : '')
    )
    setRebuild(null)
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
        setSavedKey(stateKey)
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

  // What a rebuild found, and what it didn't — before anything replaces the
  // order somebody put together on the presenter.
  //
  // Rendered from BOTH branches below: a rebuild is offered from the read-only
  // view, which returns early, so a sheet living only in the builder's tree
  // would never appear for the one case that raises it.
  const rebuildSheet = (
      <Sheet open={rebuild !== null} title="Edit this service here?" onClose={() => setRebuild(null)}>
        {rebuild && (
          <div className="px-[var(--gutter)]">
            <p className="-mt-1 mb-3 font-serif text-[17px] font-semibold text-ink">
              {rebuild.day} · {prettyDate(rebuild.date)}
            </p>
            <p className="mb-3 text-[14.5px] leading-relaxed text-ink-soft">
              Found <b className="text-ink">{rebuild.picks.length}</b> item
              {rebuild.picks.length === 1 ? '' : 's'} in the songbook. They come back as whole songs in written
              order — the deck doesn’t record which stanzas played or how lines were grouped, so those choices are
              yours to make again.
            </p>
            {rebuild.dropped.length > 0 ? (
              <>
                <p className="mb-2 text-[14.5px] leading-relaxed text-amber-700">
                  <b>{rebuild.dropped.length} item{rebuild.dropped.length === 1 ? '' : 's'} can’t be rebuilt.</b>{' '}
                  They stay on the presenter’s copy, but they will not be in this one — and saving replaces that
                  copy.
                </p>
                <div className="list-group mb-3">
                  {rebuild.dropped.map((d, i) => (
                    <div key={`${d.title}-${i}`} className="list-row">
                      <span className="min-w-0 flex-1">
                        <span className="list-title block truncate">{d.title}</span>
                        <span className="list-sub block">{d.reason}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mb-3 text-[14.5px] leading-relaxed text-ink-muted">
                Everything in it was recognised — nothing would be lost.
              </p>
            )}
            <button className="btn-app btn-app-primary btn-block" onClick={adoptRebuild}>
              Edit it here
            </button>
            <button
              className="btn-app btn-app-quiet btn-block mt-2 text-[15px]"
              onClick={() => setRebuild(null)}
            >
              Leave it alone
            </button>
            <p className="mt-2 pb-1 text-[13px] leading-relaxed text-ink-muted">
              Nothing is written until you save, and the presenter’s copy is untouched until then.
            </p>
          </div>
        )}
    </Sheet>
  )

  // A service opened for reading takes the whole screen: the builder's controls
  // all write, and showing them beside a deck they cannot change would offer an
  // edit that silently applies to something else.
  if (viewing) {
    return (
      <Screen
        title="Service Builder"
        subtitle={`${viewing.day} · ${prettyDate(viewing.date)} — open for reading.`}
      >
        <Section>
          <SavedServiceView
            envelope={viewing.envelope}
            day={viewing.day}
            date={viewing.date}
            origin={viewing.origin}
            sharing={sharing}
            onPreviewAll={() => setViewPreview('all')}
            onPreviewItem={(i) => setViewPreview(i)}
            onShare={() => void shareEnvelope(viewing.envelope, `${viewing.day} Service · ${prettyDate(viewing.date)}`)}
            onBroadcast={() => navigate(`/live/${viewing.id}`)}
            rebuilding={rebuilding}
            onRebuild={() =>
              void offerRebuild({ id: viewing.id, serviceDay: viewing.day, serviceDate: viewing.date })
            }
            onClose={() => {
              setViewing(null)
              setNote('')
            }}
          />
          {note && <p className="mt-2 px-[var(--gutter)] text-[13px] text-ink-muted">{note}</p>}
          <div className="mt-3 px-[var(--gutter)]">
            <button className="btn-app btn-app-quiet btn-block text-[15px]" onClick={() => setSavedOpen(true)}>
              Open another service
            </button>
          </div>
        </Section>

        <SavedServicesSheet
          open={savedOpen}
          onClose={() => setSavedOpen(false)}
          onPick={(s) => void openSaved(s)}
          currentDate={viewing.date}
          currentDay={viewing.day}
          busyId={openingId}
        />

        {rebuildSheet}

        {/* One item or the whole deck, from the SAME envelope — a slice keeps
            the service's own theme and background rather than the defaults a
            freshly built one would carry. */}
        <SlidePreview
          open={viewPreview !== null}
          envelope={
            viewPreview === null
              ? null
              : viewPreview === 'all'
                ? viewing.envelope
                : {
                    ...viewing.envelope,
                    service: {
                      ...viewing.envelope.service,
                      items: viewing.envelope.service.items.slice(viewPreview, viewPreview + 1)
                    }
                  }
          }
          title={
            viewPreview === null || viewPreview === 'all'
              ? viewing.envelope.service.name
              : viewing.envelope.service.items[viewPreview]?.title ?? 'Preview'
          }
          onClose={() => setViewPreview(null)}
        />
      </Screen>
    )
  }

  return (
    <Screen title="Service Builder" subtitle="Say when the service is, pick its songs and readings, then save it.">
      {/* The setup collapses once a service has items: by then it has been
          answered, and on a phone it was pushing the actual service list — the
          thing being worked on — most of a screen down. */}
      <Collapsible
        title="When"
        open={disc.isOpen('when')}
        onToggle={() => disc.toggle('when')}
        summary={`${slot.day.slice(0, 3)} · ${shortDate(slot.date)} · ${
          checking
            ? 'checking…'
            : editing
              ? 'editing saved'
              : savedId !== null
                ? 'has a service'
                : 'free'
        }`}
      >
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

        {/* Everything in the store, not only what sits on this slot — including
            the orders the presenter computer publishes, which can be read and
            broadcast here even though they can't be edited. */}
        <button
          type="button"
          onClick={() => setSavedOpen(true)}
          className="app-card pressable mt-2 flex w-full items-center gap-3 p-4 text-left"
        >
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-navy-500 text-gold-300">
            <Icon name="text" size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="list-title block">Open a saved service</span>
            <span className="list-sub block">Any day — including one built on the presenter</span>
          </span>
          <Icon name="chevron" size={17} className="list-chev" />
        </button>

        <div className="mt-3 mb-1">
          <span className="list-label">Language for new items</span>
          <Segmented options={LANGS} value={lang} onChange={setLang} ariaLabel="Lyric language" />
        </div>
      </Collapsible>

      {/* Closed unless the service already carries links: most don't, and an
          empty pair of text fields is not worth the screen it costs. */}
      <Collapsible
        title="Links"
        open={disc.isOpen('links')}
        onToggle={() => disc.toggle('links')}
        summary={links.length ? `${links.length} link${links.length === 1 ? '' : 's'}` : 'none'}
      >
        <ServiceLinksEditor links={links} onChange={setLinks} />
      </Collapsible>


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
              <div key={p.key} className="list-row flex-col !items-start gap-0 text-left">
                {/* Collapsed, an item is one line: enough to read the order and
                    check a role. Eight items with their controls open ran most
                    of a phone screen each. */}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 py-0.5 text-left"
                  onClick={() => disc.toggle(p.key)}
                  aria-expanded={disc.isOpen(p.key)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="list-title block truncate">
                      {i + 1}. {labelOf(p)}
                    </span>
                    <span className="list-sub block">
                      {p.type === 'song' ? 'Song' : 'Responsive reading'}
                      {p.type === 'song' && p.role ? ` · ${ROLE_LABEL[p.role]}` : ''}
                    </span>
                  </span>
                  <Icon
                    name="chevron"
                    size={16}
                    strokeWidth={2.4}
                    className={`flex-none text-ink-muted transition-transform duration-200 ${
                      disc.isOpen(p.key) ? 'rotate-90' : ''
                    }`}
                  />
                </button>

                <div className={`collapsible-body w-full${disc.isOpen(p.key) ? ' is-open' : ''}`}>
                <div className="pt-2">

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
                    className="icon-btn"
                    onClick={() => editPick(i)}
                    aria-label={p.type === 'song' ? 'Edit arrangement' : 'Change the psalm'}
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
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Adding lands you at the bottom of the list, so the way to add the
            next one is here too rather than only back up at the top. */}
        <div className="mt-3 flex gap-2 px-[var(--gutter)]">
          <button className="btn-app btn-app-quiet flex-1 text-[15px]" onClick={() => openPicker('songs')}>
            <Icon name="plus" size={17} strokeWidth={2.4} /> Add song
          </button>
          {!hasPsalm && (
            <button className="btn-app btn-app-quiet flex-1 text-[15px]" onClick={() => openPicker('psalms')}>
              <Icon name="plus" size={17} strokeWidth={2.4} /> Add psalm
            </button>
          )}
        </div>

        <div className="mt-3 px-[var(--gutter)]">
          <button
            className="btn-app btn-app-primary btn-block"
            onClick={() => void saveService()}
            disabled={!picks.length || saving || checking || (editing && !dirty)}
          >
            {saving
              ? 'Saving…'
              : checking
                ? 'Checking…'
                : editing
                  ? dirty
                    ? 'Save changes'
                    : 'Saved'
                  : `Create ${slot.day} service`}
          </button>
          {!saving && !checking && editing && (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
              {dirty
                ? `Editing the service saved for ${slot.day} · ${prettyDate(slot.date)}.`
                : 'No changes since this was last saved.'}
            </p>
          )}
          {!saving && !checking && !editing && savedId !== null && (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
              {slot.day} · {prettyDate(slot.date)} already has a service — saving will ask whether to open it or pick
              another day.
            </p>
          )}
        </div>
        {/* Going live reopens the SAVED service by id on the presenter screen,
            so there is nothing to broadcast until it has been saved. */}
        <div className="mt-2 px-[var(--gutter)]">
          <button
            className="btn-app btn-app-gold btn-block"
            onClick={() => savedId !== null && navigate(`/live/${savedId}`)}
            disabled={!committed}
          >
            <Icon name="broadcast" size={18} strokeWidth={2.1} /> Broadcast live
          </button>
        </div>
        <div className="mt-2 flex gap-2 px-[var(--gutter)]">
          <button
            className="btn-app btn-app-quiet flex-1 text-[15px]"
            onClick={() => void shareService()}
            disabled={!committed || sharing}
          >
            {sharing ? 'Preparing…' : 'Share'}
          </button>
          <button className="btn-app btn-app-quiet flex-1 text-[15px]" onClick={() => setPreview('all')} disabled={!picks.length}>
            Preview
          </button>
        </div>
        <p className="mt-2 px-[var(--gutter)] text-[13px] leading-relaxed text-ink-muted">
          {!picks.length
            ? 'Add some songs, then save the service to share or broadcast it.'
            : !committed
              ? 'Save the service to share or broadcast it — both work from the saved copy, never from unsaved edits.'
              : 'Broadcast puts this service on air from this device — no computer, no OBS. The church follows it under Watch, and a volunteer can move the slides from Operator.'}
        </p>

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

      <Sheet
        open={editingPsalm !== null}
        title="Change the psalm"
        onClose={() => setEditingPsalm(null)}
      >
        {editingPsalm && (
          <PsalmFields
            // Re-seed whenever a different psalm is opened.
            key={`${editingPsalm.at}-${editingPsalm.chapter}`}
            initial={editingPsalm}
            submitVerb="Save"
            onSubmit={async (c, f, t) => {
              const ok = await addPsalm(c, f, t, editingPsalm.at)
              if (ok) setEditingPsalm(null)
              return ok
            }}
          />
        )}
      </Sheet>

      <ServicePickerSheet
        open={pickerOpen}
        source={pickerSource()}
        allowPsalms={!hasPsalm}
        onSourceChange={setSource}
        onClose={() => setPickerOpen(false)}
        onPickSong={(m) => void openSong(m)}
        onAddPsalm={addPsalm}
      />

      <SavedServicesSheet
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        onPick={(s) => void openSaved(s)}
        currentDate={slot.date}
        currentDay={slot.day}
        busyId={openingId}
      />

      <ServiceExistsSheet
        open={exists !== null}
        slotLabel={`${slot.day} · ${prettyDate(slot.date)}`}
        detail={exists?.detail}
        // A deck that can be read can be worked back into picks, so "make edits"
        // is offered for it too — it just goes the long way round.
        canLoad={(exists?.canLoad ?? false) || (exists?.canView ?? false)}
        canView={exists?.canView ?? false}
        rebuilds={!exists?.canLoad && (exists?.canView ?? false)}
        busy={loadingExisting || openingId !== null || rebuilding}
        onLoad={() => {
          if (!exists) return
          if (exists.canLoad) void loadExisting()
          else void offerRebuild({ id: exists.id, serviceDay: slot.day, serviceDate: slot.date })
        }}
        onView={() => {
          if (exists) void openSaved({ id: exists.id, serviceDay: slot.day, serviceDate: slot.date })
          setExists(null)
        }}
        onNewSlot={() => {
          setExists(null)
          setSlotOpen(true)
        }}
        onDismiss={() => setExists(null)}
      />

      {rebuildSheet}

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
