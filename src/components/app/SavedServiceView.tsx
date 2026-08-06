import { Icon } from './Icons'
import { prettyDate } from '../../lib/serviceSlot'
import { usableLinks } from '../../lib/links'
import type { ServiceEnvelope } from '../../lib/buildService'

/**
 * A service this app can read but not rewrite.
 *
 * An order assembled on the projection machine is a finished deck: welcome
 * cards, a countdown, media, the sermon, and the songs already rendered to
 * slides. What produced it — which stanzas, which repeats, which lines share a
 * slide — was decided there and is not recorded in the deck, so there is no
 * honest way to reopen it in a pick editor. Rebuilding it from the titles would
 * mean guessing the arrangement and dropping everything that isn't a song, and
 * then saving would quietly replace the real order with that guess.
 *
 * So it opens as what it is. Everything that only reads the deck still works —
 * preview it, share the sheet, put it on air — and the one thing that would
 * lose someone's work is the one thing missing.
 */
export function SavedServiceView({
  envelope,
  day,
  date,
  origin,
  sharing,
  onPreviewAll,
  onPreviewItem,
  onShare,
  onBroadcast,
  onClose
}: {
  envelope: ServiceEnvelope
  day: string
  date: string
  /** Where it came from, when the deck says. */
  origin: 'presenter' | 'unknown'
  sharing: boolean
  onPreviewAll: () => void
  onPreviewItem: (index: number) => void
  onShare: () => void
  onBroadcast: () => void
  onClose: () => void
}): JSX.Element {
  const items = envelope.service.items ?? []
  const links = usableLinks(envelope.service.links)
  const slides = items.reduce((n, it) => n + (it.slides?.length ?? 0), 0)
  /** Slides with words on them — the only ones a phone broadcast can carry. */
  const withText = items.reduce(
    (n, it) => n + (it.slides ?? []).filter((s) => (s.lines ?? []).some((l) => l && l.trim())).length,
    0
  )

  return (
    <>
      <div className="app-card mx-[var(--gutter)] p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-navy-700 text-gold-300">
            <Icon name="broadcast" size={19} strokeWidth={2.1} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="list-title truncate">{envelope.service.name}</p>
            <p className="list-sub">
              {day} · {prettyDate(date)} · {items.length} item{items.length === 1 ? '' : 's'} · {slides} slide
              {slides === 1 ? '' : 's'}
            </p>
            <span className="pill mt-1.5 bg-line/60 text-ink-muted">
              {origin === 'presenter' ? 'Built on the presenter' : 'Saved without an arrangement'}
            </span>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close this service">
            <Icon name="close" size={17} />
          </button>
        </div>
        <p className="mt-3 border-t border-line pt-3 text-[13px] leading-relaxed text-ink-muted">
          {origin === 'presenter'
            ? 'This order was put together on the presenter computer, so its songs can’t be rearranged here. You can read it, share it, and broadcast it.'
            : 'This service was saved before the builder kept a record of how it was assembled, so it can’t be reopened for editing. You can still read, share and broadcast it.'}
        </p>
      </div>

      {links.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 px-[var(--gutter)]">
          {links.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className={`btn-app flex-1 text-[15px] ${l.kind === 'youtube' ? 'btn-app-gold' : 'btn-app-quiet'}`}
            >
              {l.label} <Icon name="external" size={16} strokeWidth={2.2} />
            </a>
          ))}
        </div>
      )}

      <div className="list-group mt-3">
        {items.map((it, i) => {
          const n = it.slides?.length ?? 0
          return (
            <button
              key={it.id ?? i}
              type="button"
              className="list-row has-ico"
              onClick={() => onPreviewItem(i)}
              disabled={!n}
            >
              <span className="list-ico bg-navy-500">
                <Icon name={it.kind === 'scripture' ? 'text' : 'songs'} size={18} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="list-title block truncate">
                  {i + 1}. {it.title}
                </span>
                <span className="list-sub block">
                  {n} slide{n === 1 ? '' : 's'}
                  {it.slot ? ` · ${it.slot}` : ''}
                </span>
              </span>
              <Icon name="eye" size={17} className="list-chev" />
            </button>
          )
        })}
      </div>

      <div className="mt-3 px-[var(--gutter)]">
        <button className="btn-app btn-app-gold btn-block" onClick={onBroadcast} disabled={!withText}>
          <Icon name="broadcast" size={18} strokeWidth={2.1} /> Broadcast live
        </button>
      </div>
      <div className="mt-2 flex gap-2 px-[var(--gutter)]">
        <button className="btn-app btn-app-quiet flex-1 text-[15px]" onClick={onShare} disabled={sharing}>
          {sharing ? 'Preparing…' : 'Share'}
        </button>
        <button className="btn-app btn-app-quiet flex-1 text-[15px]" onClick={onPreviewAll} disabled={!slides}>
          Preview
        </button>
      </div>
      <p className="mt-2 px-[var(--gutter)] text-[13px] leading-relaxed text-ink-muted">
        {/* A phone broadcast carries words, not the presenter's video, images or
            countdown — so say how much of this order would actually go out. */}
        {withText === slides
          ? 'Broadcasting puts this service on air from this device. The church follows it under Watch.'
          : `Broadcasting carries the ${withText} slide${withText === 1 ? '' : 's'} that have words on them — the countdown, media and blank cards stay on the presenter’s screen.`}
      </p>
    </>
  )
}
