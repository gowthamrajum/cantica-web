import { useEffect, useMemo, useState } from 'react'
import { Sheet } from './Sheet'
import { Icon } from './Icons'
import {
  buildSongArrangement,
  detectRecurringSection,
  songSections,
  songToItem,
  type ServiceLang,
  type SongStructure
} from '../../lib/buildService'
import type { Song } from '../../lib/songs'

/**
 * Which stanzas play, in what order, and which one comes back between them.
 *
 * A song as written is rarely a song as sung: the Pallavi returns after each
 * stanza, and a Sunday usually takes three of the six verses. Adding one without
 * asking gets the whole thing in written order, which is almost never the
 * arrangement anybody wanted.
 *
 * The repeat is guessed (an explicit chorus, else a telltale label, else a block
 * of lyrics that appears twice) so the common case is already right and the
 * sheet only has to be confirmed.
 */
export function SongStructureSheet({
  song,
  lang,
  onCancel,
  onAdd
}: {
  song: Song | null
  lang: ServiceLang
  onCancel: () => void
  onAdd: (structure: SongStructure) => void
}): JSX.Element | null {
  const sections = useMemo(() => (song ? songSections(song, lang) : []), [song, lang])
  const [order, setOrder] = useState<string[]>([])
  const [included, setIncluded] = useState<Set<string>>(new Set())
  const [recurring, setRecurring] = useState<string | null>(null)

  // Re-seed whenever a different song (or language) opens the sheet.
  useEffect(() => {
    if (!song) return
    setOrder(sections.map((s) => s.id))
    setIncluded(new Set(sections.map((s) => s.id)))
    setRecurring(detectRecurringSection(sections))
  }, [song, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  const byId = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections])
  const includedInOrder = order.filter((id) => included.has(id))

  const toggle = (id: string): void =>
    setIncluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const move = (id: string, dir: -1 | 1): void =>
    setOrder((prev) => {
      const i = prev.indexOf(id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = prev.slice()
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  // The real arrangement and the real slide count, from the same functions the
  // export uses — so what this promises is what lands in Cantica.
  const structure: SongStructure = { includedIds: includedInOrder, recurringId: recurring }
  const playOrder = buildSongArrangement(sections, includedInOrder, recurring)
  const slideCount = song ? (songToItem(song, lang, structure)?.slides.length ?? 0) : 0

  return (
    <Sheet
      open={!!song}
      title={song?.song_name ?? 'Add song'}
      onClose={onCancel}
      footer={
        <div className="flex gap-2">
          <button className="btn-app btn-app-quiet flex-1 text-[15px]" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-app btn-app-primary flex-1 text-[15px]"
            disabled={!includedInOrder.length}
            onClick={() => onAdd(structure)}
          >
            Add {slideCount} slide{slideCount === 1 ? '' : 's'}
          </button>
        </div>
      }
    >
      <p className="mb-3 text-[13px] leading-relaxed text-ink-muted">
        Untick a stanza to leave it out. The one marked <b>repeats</b> comes back between the
        others — usually the Pallavi.
      </p>

      <div className="list-group">
        <button
          className={`list-row w-full text-left ${recurring === null ? 'bg-black/[0.035]' : ''}`}
          onClick={() => setRecurring(null)}
        >
          <span className="min-w-0 flex-1">
            <span className="list-title block">Nothing repeats</span>
            <span className="list-sub block">Play the stanzas straight through</span>
          </span>
          {recurring === null && <Icon name="check" size={17} />}
        </button>
      </div>

      <div className="list-group mt-3">
        {order.map((id, idx) => {
          const sec = byId.get(id)
          if (!sec) return null
          const on = included.has(id)
          const first = sec.lines.find((l) => l.trim()) ?? '—'
          return (
            <div key={id} className={`list-row gap-2 ${on ? '' : 'opacity-45'}`}>
              <button className="icon-btn flex-none" onClick={() => toggle(id)} aria-label={on ? 'Leave out' : 'Include'}>
                <Icon name={on ? 'check' : 'plus'} size={17} />
              </button>
              <span className="min-w-0 flex-1">
                <span className="list-title block">{sec.label}</span>
                <span className="list-sub block truncate">{first}</span>
              </span>
              <button
                className={`flex-none rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${
                  recurring === id ? 'bg-gold-500 text-white' : 'bg-black/5 text-ink-muted'
                } disabled:opacity-40`}
                disabled={!on}
                onClick={() => setRecurring(id)}
              >
                Repeats
              </button>
              <span className="flex flex-none flex-col">
                <button className="icon-btn h-5" onClick={() => move(id, -1)} disabled={idx === 0} aria-label="Move up">
                  <Icon name="chevron" size={14} className="-rotate-90" />
                </button>
                <button
                  className="icon-btn h-5"
                  onClick={() => move(id, 1)}
                  disabled={idx === order.length - 1}
                  aria-label="Move down"
                >
                  <Icon name="chevron" size={14} className="rotate-90" />
                </button>
              </span>
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-[13px] text-ink-muted">
        <b>Plays as:</b>{' '}
        {playOrder.length
          ? playOrder.map((id) => byId.get(id)?.label ?? id).join(' → ')
          : 'nothing selected'}
      </p>
    </Sheet>
  )
}
