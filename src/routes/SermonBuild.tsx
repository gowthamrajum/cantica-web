import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Screen, Section } from '../components/app/Screen'
import { Icon } from '../components/app/Icons'
import { SermonOutlineFields } from '../components/app/SermonOutlineFields'
import { getSermon, listServices, saveSermon, type SermonOutline, type ServiceSummary } from '../lib/relay'
import { prettyDate } from '../lib/serviceSlot'

/** YYYY-MM-DD for a day offset from today, in local time. */
const isoDay = (offset = 0): string => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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
 */
export function SermonBuild(): JSX.Element {
  const [params, setParams] = useSearchParams()
  const chosenId = Number(params.get('service')) || null

  const [services, setServices] = useState<ServiceSummary[] | null>(null)
  /** What the relay has for the chosen service: undefined while loading. */
  const [stored, setStored] = useState<SermonOutline | null | undefined>(undefined)
  const [draft, setDraft] = useState<SermonOutline | null>(null)
  /** Bumped to restart the fields from what was loaded (they hold their own text). */
  const [fieldsKey, setFieldsKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')

  // A week back (the relay keeps a service that long) to two months ahead.
  useEffect(() => {
    let alive = true
    void listServices(isoDay(-7), isoDay(60)).then((list) => {
      if (alive) setServices([...list].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate) || a.id - b.id))
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!chosenId) return
    let alive = true
    setStored(undefined)
    setNote('')
    void getSermon(chosenId).then((o) => {
      if (!alive) return
      if (o === undefined) {
        setNote('Couldn’t load this service’s outline. Check your connection and try again.')
        return
      }
      setStored(o)
      setDraft(o)
      setFieldsKey((k) => k + 1)
    })
    return () => {
      alive = false
    }
  }, [chosenId])

  const chosen = useMemo(() => services?.find((s) => s.id === chosenId) ?? null, [services, chosenId])
  const today = isoDay()
  const upcoming = (services ?? []).filter((s) => s.serviceDate >= today)
  const past = (services ?? []).filter((s) => s.serviceDate < today)
  const dirty = stored !== undefined && JSON.stringify(draft) !== JSON.stringify(stored)

  const save = async (next: SermonOutline | null): Promise<void> => {
    if (!chosenId) return
    setSaving(true)
    const r = await saveSermon(chosenId, next)
    setSaving(false)
    if (!r.ok) {
      setNote(r.message)
      return
    }
    setStored(next)
    setDraft(next)
    if (!next) setFieldsKey((k) => k + 1)
    setServices((list) => list?.map((s) => (s.id === chosenId ? { ...s, hasSermon: !!next } : s)) ?? list)
    setNote(
      next
        ? 'Saved. It goes into the Sermon, straight after its card, the next time the service is loaded.'
        : 'Outline removed from this service.'
    )
  }

  const row = (s: ServiceSummary): JSX.Element => (
    <button
      key={s.id}
      type="button"
      className="list-row pressable w-full text-left"
      onClick={() => setParams({ service: String(s.id) })}
    >
      <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-navy-700 text-gold-300">
        <Icon name="calendar" size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="list-title block">{s.serviceDay}</span>
        <span className="list-sub block">{prettyDate(s.serviceDate)}</span>
      </span>
      {s.hasSermon ? (
        <span className="pill bg-emerald-50 text-emerald-700">Has outline</span>
      ) : (
        <span className="pill bg-line/60 text-ink-muted">No outline</span>
      )}
      <Icon name="chevron" size={17} className="list-chev" />
    </button>
  )

  if (!chosenId) {
    return (
      <Screen title="Sermon Builder" subtitle="Pick the service, then write the sermon’s title and points.">
        <Section>
          {services === null ? (
            <div className="flex items-center justify-center gap-2.5 py-16 text-[15px] text-ink-muted">
              <span className="spinner" /> Finding services…
            </div>
          ) : !services.length ? (
            <p className="px-[var(--gutter)] text-[15px] leading-relaxed text-ink-muted">
              No services saved yet. Build Sunday’s service in the{' '}
              <Link to="/build" className="underline">
                Service Builder
              </Link>{' '}
              first, then come back to give it an outline.
            </p>
          ) : (
            <>
              {upcoming.length > 0 && (
                <>
                  <span className="list-label px-[var(--gutter)]">Coming up</span>
                  <div className="list-group mt-1">{upcoming.map(row)}</div>
                </>
              )}
              {past.length > 0 && (
                <>
                  <span className="list-label mt-4 block px-[var(--gutter)]">This past week</span>
                  <div className="list-group mt-1">{past.map(row)}</div>
                </>
              )}
            </>
          )}
        </Section>
      </Screen>
    )
  }

  return (
    <Screen
      title="Sermon Builder"
      subtitle="One slide in the Sermon, straight after its card."
      back={{ to: '/sermon', label: 'Services' }}
    >
      <Section>
        <button
          type="button"
          onClick={() => setParams({})}
          className="app-card pressable flex w-[calc(100%_-_2*var(--gutter))] items-center gap-3 p-4 text-left"
        >
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-navy-700 text-gold-300">
            <Icon name="calendar" size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="list-title block">{chosen?.serviceDay ?? 'Service'}</span>
            <span className="list-sub block">{chosen ? prettyDate(chosen.serviceDate) : 'Loading…'}</span>
          </span>
          <span className="text-[13px] font-semibold text-navy-700">Change</span>
        </button>
      </Section>

      <Section>
        <span className="list-label px-[var(--gutter)]">Outline</span>
        {stored === undefined && !note ? (
          <div className="flex items-center justify-center gap-2.5 py-10 text-[15px] text-ink-muted">
            <span className="spinner" /> Loading…
          </div>
        ) : (
          <SermonOutlineFields key={fieldsKey} initial={stored ?? null} onChange={setDraft} />
        )}

        <div className="mt-3 space-y-2 px-[var(--gutter)]">
          <button
            className="btn-app btn-app-primary btn-block"
            disabled={!dirty || !draft || saving}
            onClick={() => void save(draft)}
          >
            {saving ? 'Saving…' : stored ? 'Save changes' : 'Save outline'}
          </button>
          {stored && (
            <button className="btn-app btn-app-quiet btn-block" disabled={saving} onClick={() => void save(null)}>
              Remove the outline
            </button>
          )}
          {note && <p className="text-[13.5px] leading-relaxed text-ink-muted">{note}</p>}
        </div>
      </Section>
    </Screen>
  )
}
