import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Screen, Section } from '../components/app/Screen'
import { Icon } from '../components/app/Icons'
import { Collapsible } from '../components/app/Collapsible'
import { useDisclosure } from '../components/app/useDisclosure'
import { ServiceSlotSheet } from '../components/app/ServiceSlotSheet'
import { SavedServicesSheet } from '../components/app/SavedServicesSheet'
import { SermonOutlineFields } from '../components/app/SermonOutlineFields'
import {
  createService,
  findService,
  getService,
  getSermon,
  saveSermon,
  type SermonOutline,
  type ServiceSummary
} from '../lib/relay'
import { buildService } from '../lib/buildService'
import { toBuilderState } from '../lib/builderState'
import { defaultSlot, prettyDate, shortDate, type DayName, type ServiceSlot } from '../lib/serviceSlot'

/**
 * The Sermon Builder — the preacher's outline, written apart from the service.
 *
 * It used to be a section of the Service Builder, which meant the preacher and
 * whoever was building Sunday's order were saving the same thing, and the
 * second save quietly took back the first. Here the outline is attached to a
 * service on its own: the relay keeps it in its own field and puts it into the
 * deck whenever the service is read, so the presenter still finds it inside the
 * Sermon, straight after the card — and the phone's "Back to outline" still
 * lands on it.
 *
 * It opens the way the Service Builder does — say when the service is — so the
 * two read as one tool. A day with no service yet is fine: saving the outline
 * creates the service, empty, and whoever builds the songs later opens it as
 * the saved service for that day.
 */
export function SermonBuild(): JSX.Element {
  const [params, setParams] = useSearchParams()
  const disc = useDisclosure(['when'])

  const [slot, setSlot] = useState<ServiceSlot>(defaultSlot)
  const [slotOpen, setSlotOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  /** The service filed under the slot; null = none yet; undefined = checking. */
  const [service, setService] = useState<ServiceSummary | null | undefined>(undefined)
  /** What the relay has for that service: undefined while loading. */
  const [stored, setStored] = useState<SermonOutline | null | undefined>(undefined)
  const [draft, setDraft] = useState<SermonOutline | null>(null)
  /** Bumped to restart the fields from what was loaded (they hold their own text). */
  const [fieldsKey, setFieldsKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  /** Only the newest check may land — a slow answer for the old slot must not. */
  const token = useRef(0)

  /** Point at a service (or a free slot) and load its outline. */
  const show = useCallback(
    async (s: ServiceSummary | null): Promise<void> => {
      const mine = ++token.current
      setService(s)
      setNote('')
      setParams(s ? { service: String(s.id) } : {}, { replace: true })
      if (!s) {
        setStored(null)
        setDraft(null)
        setFieldsKey((k) => k + 1)
        return
      }
      setStored(undefined)
      const o = await getSermon(s.id)
      if (mine !== token.current) return
      if (o === undefined) {
        setNote('Couldn’t load this service’s outline. Check your connection and try again.')
        return
      }
      setStored(o)
      setDraft(o)
      setFieldsKey((k) => k + 1)
    },
    [setParams]
  )

  const check = useCallback(
    async (s: ServiceSlot): Promise<void> => {
      const mine = ++token.current
      setService(undefined)
      const found = await findService(s.day, s.date)
      if (mine !== token.current) return
      await show(found)
    },
    [show]
  )

  // Opened from the Service Builder on a particular service, or fresh on the
  // next Sunday — the same default the Service Builder starts from.
  useEffect(() => {
    const id = Number(params.get('service'))
    if (id) {
      void getService(id).then((s) => {
        if (s) {
          setSlot({ day: s.serviceDay as DayName, date: s.serviceDate })
          void show(s)
        } else void check(slot)
      })
    } else void check(slot)
    // Once, on arrival; after that the slot sheet drives it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dirty = stored !== undefined && JSON.stringify(draft) !== JSON.stringify(stored)

  const save = async (next: SermonOutline | null): Promise<void> => {
    setSaving(true)
    setNote('')
    let target = service ?? null
    // No service on this day yet: create it, empty, so the outline has
    // something to belong to. The Service Builder then opens it as the saved
    // service for the day and fills in the songs.
    if (!target && next) {
      const payload = {
        ...buildService(`${slot.day} Service · ${prettyDate(slot.date)}`),
        builder: toBuilderState(slot.day, slot.date, [], [])
      }
      const r = await createService(slot.day, slot.date, payload)
      if (r.ok) target = r.service
      else if ('conflict' in r) target = r.conflict.existing // someone created it a moment ago
      else {
        setSaving(false)
        setNote(r.message)
        return
      }
    }
    if (!target) {
      setSaving(false)
      return
    }
    const r = await saveSermon(target.id, next)
    setSaving(false)
    if (!r.ok) {
      setNote(r.message)
      return
    }
    const created = !service
    setService(target)
    setParams({ service: String(target.id) }, { replace: true })
    setStored(next)
    setDraft(next)
    if (!next) setFieldsKey((k) => k + 1)
    setNote(
      !next
        ? 'Outline removed from this service.'
        : created
          ? `Created the ${slot.day} service for ${prettyDate(slot.date)} with this outline. Add its songs in the Service Builder.`
          : 'Saved. It goes into the Sermon, straight after its card.'
    )
  }

  const checking = service === undefined

  return (
    <Screen title="Sermon Builder" subtitle="Say when the service is, then write the sermon’s title and points.">
      <Collapsible
        title="When"
        open={disc.isOpen('when')}
        onToggle={() => disc.toggle('when')}
        summary={`${slot.day.slice(0, 3)} · ${shortDate(slot.date)} · ${
          checking ? 'checking…' : service ? (stored ? 'has an outline' : 'no outline yet') : 'no service yet'
        }`}
      >
        <button
          type="button"
          onClick={() => setSlotOpen(true)}
          className="app-card pressable mt-1 flex w-[calc(100%_-_2*var(--gutter))] items-center gap-3 p-4 text-left"
        >
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-navy-700 text-gold-300">
            <Icon name="calendar" size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="list-title block">{slot.day}</span>
            <span className="list-sub block">{prettyDate(slot.date)}</span>
            {checking ? (
              <span className="mt-1 block text-[12.5px] text-ink-muted">Checking this day…</span>
            ) : !service ? (
              <span className="pill mt-1.5 bg-line/60 text-ink-muted">No service yet — saving creates it</span>
            ) : stored ? (
              <span className="pill mt-1.5 bg-emerald-50 text-emerald-700">Has an outline</span>
            ) : (
              <span className="pill mt-1.5 bg-amber-100 text-amber-800">Has a service, no outline yet</span>
            )}
          </span>
          <Icon name="chevron" size={17} className="list-chev" />
        </button>

        <button
          type="button"
          onClick={() => setSavedOpen(true)}
          className="app-card pressable mt-2 flex w-[calc(100%_-_2*var(--gutter))] items-center gap-3 p-4 text-left"
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
      </Collapsible>

      <Section>
        <span className="list-label px-[var(--gutter)]">Sermon outline</span>
        {checking || (service && stored === undefined && !note) ? (
          <div className="flex items-center justify-center gap-2.5 py-10 text-[15px] text-ink-muted">
            <span className="spinner" /> Loading…
          </div>
        ) : (
          <SermonOutlineFields key={fieldsKey} initial={stored ?? null} onChange={setDraft} />
        )}

        <div className="mt-3 space-y-2 px-[var(--gutter)]">
          <button
            className="btn-app btn-app-primary btn-block"
            disabled={checking || !dirty || !draft || saving}
            onClick={() => void save(draft)}
          >
            {saving
              ? 'Saving…'
              : !service
                ? 'Create the service with this outline'
                : stored
                  ? 'Save changes'
                  : 'Save outline'}
          </button>
          {stored && (
            <button className="btn-app btn-app-quiet btn-block" disabled={saving} onClick={() => void save(null)}>
              Remove the outline
            </button>
          )}
          {note && <p className="text-[13.5px] leading-relaxed text-ink-muted">{note}</p>}
        </div>
      </Section>

      <ServiceSlotSheet
        open={slotOpen}
        slot={slot}
        onCancel={() => setSlotOpen(false)}
        onConfirm={(s) => {
          setSlot(s)
          setSlotOpen(false)
          void check(s)
        }}
      />
      <SavedServicesSheet
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        onPick={(s) => {
          setSavedOpen(false)
          setSlot({ day: s.serviceDay as DayName, date: s.serviceDate })
          void show(s)
        }}
        currentDate={slot.date}
        currentDay={slot.day}
      />
    </Screen>
  )
}
