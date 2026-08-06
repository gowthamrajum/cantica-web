import { Fragment } from 'react'
import { Icon, type IconName } from './Icons'
import { prettyDate } from '../../lib/serviceSlot'
import { usableLinks } from '../../lib/links'
import type { ItemKind, ServiceEnvelope, ServiceItem } from '../../lib/buildService'

/** Read the order at a glance: a clip and a countdown should not both be notes. */
const ICON_FOR: Partial<Record<ItemKind, IconName>> = {
  song: 'songs',
  scripture: 'text',
  text: 'text',
  media: 'watch',
  video: 'watch',
  countdown: 'calendar',
  blank: 'minus'
}

/**
 * The gap between two items, and the way something gets into it.
 *
 * Kept deliberately quiet — a thin rule with a small plus — because there is one
 * of these between every pair of rows, and a service of a dozen items would
 * otherwise be half buttons.
 */
function InsertHere({
  at,
  onAdd,
  disabled
}: {
  at: number
  onAdd: (at: number) => void
  disabled?: boolean
}): JSX.Element {
  return (
    <div className="insert-gap">
      <button
        type="button"
        className="insert-gap-btn"
        onClick={() => onAdd(at)}
        disabled={disabled}
        aria-label={`Add something at position ${at + 1}`}
      >
        <Icon name="plus" size={15} strokeWidth={2.6} />
      </button>
    </div>
  )
}

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
  rebuilding,
  items,
  onMove,
  dirty,
  saving,
  onSaveOrder,
  onResetOrder,
  onAdd,
  onRemove,
  onPreviewAll,
  onPreviewItem,
  onShare,
  onBroadcast,
  onRebuild,
  onClose
}: {
  envelope: ServiceEnvelope
  day: string
  date: string
  /** Where it came from, when the deck says. */
  origin: 'presenter' | 'unknown'
  sharing: boolean
  rebuilding?: boolean
  onPreviewAll: () => void
  onPreviewItem: (index: number) => void
  onShare: () => void
  onBroadcast: () => void
  /** Work the deck back into editable picks — it reports what it can't first. */
  onRebuild?: () => void
  /** The order being edited — the stored one until something is moved. */
  items: ServiceItem[]
  onMove: (index: number, dir: -1 | 1) => void
  dirty: boolean
  saving: boolean
  onSaveOrder: () => void
  onResetOrder: () => void
  /** Put something new in at this index. */
  onAdd?: (at: number) => void
  onRemove?: (index: number) => void
  onClose: () => void
}): JSX.Element {
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
            ? 'This order was put together on the presenter computer. Read it, share it and broadcast it as it is — or rebuild its songs to edit them here.'
            : 'This service was saved before the builder kept a record of how it was assembled. Read it, share it and broadcast it as it is — or rebuild its songs to edit them here.'}
        </p>
        {onRebuild && (
          <button
            className="btn-app btn-app-quiet btn-block mt-3 text-[15px]"
            onClick={onRebuild}
            disabled={rebuilding}
          >
            {rebuilding ? 'Looking…' : 'Rebuild its songs to edit'}
          </button>
        )}
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
        {/* A gap before the first item too: something has to be able to go at
            the top of a service, not only after whatever is already there. */}
        {onAdd && <InsertHere at={0} onAdd={onAdd} disabled={saving} />}
        {items.map((it, i) => {
          const n = it.slides?.length ?? 0
          return (
            <Fragment key={it.id ?? i}>
            <div className="list-row has-ico">
              <span className="list-ico bg-navy-500">
                <Icon name={ICON_FOR[it.kind] ?? 'songs'} size={18} strokeWidth={2} />
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
              {/* Moving an item needs nothing the deck doesn't already hold, so
                  it is the one edit that can be made here without loss — the
                  slides travel exactly as the presenter built them. */}
              <button
                type="button"
                className="icon-btn"
                onClick={() => onMove(i, -1)}
                disabled={i === 0 || saving}
                aria-label={`Move ${it.title} up`}
              >
                <Icon name="chevron" size={17} className="-rotate-90" />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => onMove(i, 1)}
                disabled={i === items.length - 1 || saving}
                aria-label={`Move ${it.title} down`}
              >
                <Icon name="chevron" size={17} className="rotate-90" />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => onPreviewItem(i)}
                disabled={!n}
                aria-label={`Preview ${it.title}`}
              >
                <Icon name="eye" size={17} />
              </button>
              {onRemove && (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => onRemove(i)}
                  disabled={saving}
                  aria-label={`Remove ${it.title}`}
                >
                  <Icon name="close" size={17} />
                </button>
              )}
            </div>
            {onAdd && <InsertHere at={i + 1} onAdd={onAdd} disabled={saving} />}
            </Fragment>
          )
        })}
      </div>

      {/* Only once something has moved: a Save that is always there invites the
          question of what it would save. */}
      {dirty && (
        <div className="mt-3 px-[var(--gutter)]">
          <button className="btn-app btn-app-primary btn-block" onClick={onSaveOrder} disabled={saving}>
            {saving ? 'Saving…' : 'Save the new order'}
          </button>
          <button
            className="btn-app btn-app-quiet btn-block mt-2 text-[15px]"
            onClick={onResetOrder}
            disabled={saving}
          >
            Put it back
          </button>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            Only the order changes. Every slide — the videos, the countdown, the announcement layouts — is written
            back exactly as the presenter built it.
          </p>
        </div>
      )}

      <div className="mt-3 px-[var(--gutter)]">
        <button
          className="btn-app btn-app-gold btn-block"
          onClick={onBroadcast}
          disabled={!withText || dirty || saving}
        >
          <Icon name="broadcast" size={18} strokeWidth={2.1} /> Broadcast live
        </button>
      </div>
      <div className="mt-2 flex gap-2 px-[var(--gutter)]">
        <button
          className="btn-app btn-app-quiet flex-1 text-[15px]"
          onClick={onShare}
          disabled={sharing || dirty || saving}
        >
          {sharing ? 'Preparing…' : 'Share'}
        </button>
        <button className="btn-app btn-app-quiet flex-1 text-[15px]" onClick={onPreviewAll} disabled={!slides}>
          Preview
        </button>
      </div>
      {dirty && (
        <p className="mt-2 px-[var(--gutter)] text-[13px] leading-relaxed text-ink-muted">
          Save the new order before sharing or broadcasting — both work from the stored copy, which still has the
          old one.
        </p>
      )}
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
