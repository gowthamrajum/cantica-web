import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Sheet } from './Sheet'
import { Icon } from './Icons'
import {
  applyOrder,
  autoGroups,
  buildSongArrangement,
  detectRecurringSection,
  formatLyricLine,
  sectionUnits,
  songSections,
  songToItem,
  unitLines,
  type ServiceLang,
  type SongStructure
} from '../../lib/buildService'
import type { Song } from '../../lib/songs'

/**
 * Which slide a dropped line joins when it lands on the seam between two.
 *
 * 'above' is the end of the slide before the seam, 'below' the start of the one
 * after. Both are the same position in the list, so the drop has to say which
 * was meant — without it, a line can only ever be added to the end of a slide,
 * and reaching the top of the next one means dropping it second and shuffling.
 */
type Join = 'above' | 'below'

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
  initial = null,
  confirmVerb = 'Add',
  onCancel,
  onAdd
}: {
  song: Song | null
  lang: ServiceLang
  /** An arrangement to reopen on, when editing a song already in the service. */
  initial?: SongStructure | null
  /** 'Add' when the song is landing, 'Save' when an existing one is reopened. */
  confirmVerb?: string
  onCancel: () => void
  onAdd: (structure: SongStructure) => void
}): JSX.Element | null {
  const sections = useMemo(() => (song ? songSections(song, lang) : []), [song, lang])
  const [order, setOrder] = useState<string[]>([])
  const [included, setIncluded] = useState<Set<string>>(new Set())
  const [recurring, setRecurring] = useState<string | null>(null)
  /** section id -> units per slide. Absent = however the automatic split falls. */
  const [groups, setGroups] = useState<Record<string, number[]>>({})
  /** section id -> the units' order, once a line has been moved. */
  const [lineOrder, setLineOrder] = useState<Record<string, number[]>>({})
  /** which section's slides are open for editing */
  const [editing, setEditing] = useState<string | null>(null)
  /**
   * The line being held, and where it would land.
   *
   * `join` is which side of a slide heading the drop sits on — the difference
   * between the last line of one slide and the first line of the next, which is
   * the same insertion point and cannot be told apart by index alone.
   */
  const [drag, setDrag] = useState<{ sec: string; from: number; to: number; join: Join } | null>(null)

  // Re-seed whenever a different song (or language) opens the sheet. An
  // `initial` arrangement means we're reopening a song already in the service,
  // so restore what was chosen last time instead of guessing afresh; the
  // included ids also carry the play order, which is what the sheet edits.
  useEffect(() => {
    if (!song) return
    const all = sections.map((s) => s.id)
    const kept = initial?.includedIds?.filter((id) => all.includes(id))
    // includedIds is the arrangement WITH the repeat woven in; the sheet works
    // in distinct sections, so take each id once, in first-seen order.
    const distinct = kept ? [...new Set(kept)] : null
    setOrder(distinct?.length ? [...distinct, ...all.filter((id) => !distinct.includes(id))] : all)
    setIncluded(new Set(distinct?.length ? distinct : all))
    setRecurring(
      initial ? (initial.recurringId ?? null) : detectRecurringSection(sections)
    )
    setGroups(initial?.groups ?? {})
    setLineOrder(initial?.order ?? {})
    setEditing(null)
  }, [song, lang, initial]) // eslint-disable-line react-hooks/exhaustive-deps

  const byId = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections])
  const bilingual = lang === 'both'
  const lpp = bilingual ? 4 : 2
  const linesOf = (id: string): string[] =>
    (byId.get(id)?.lines ?? []).filter((l) => l && l.trim()).map(formatLyricLine)
  /** A section's lines as indivisible units, in the operator's order — in
   *  bilingual mode a Telugu line and its transliteration are one unit and can
   *  never be split apart or moved apart. */
  const unitsOf = (id: string): ReturnType<typeof sectionUnits> =>
    applyOrder(sectionUnits(linesOf(id), bilingual), lineOrder[id])
  const groupsOf = (id: string): number[] => {
    const chosen = groups[id]
    if (chosen?.length) return chosen
    return autoGroups(linesOf(id), bilingual, lpp)
  }
  /** Groups as the set of unit indexes a slide STARTS at — the form a tap edits. */
  const breaksOf = (id: string): Set<number> => {
    const out = new Set<number>()
    let at = 0
    for (const g of groupsOf(id).slice(0, -1)) {
      at += g
      out.add(at)
    }
    return out
  }
  const toggleBreak = (id: string, at: number): void => {
    const breaks = breaksOf(id)
    if (breaks.has(at)) breaks.delete(at)
    else breaks.add(at)
    const total = unitsOf(id).length
    const starts = [0, ...[...breaks].sort((a, b) => a - b)]
    const next: number[] = []
    for (let i = 0; i < starts.length; i++) next.push((starts[i + 1] ?? total) - starts[i])
    setGroups((prev) => ({ ...prev, [id]: next }))
  }

  /** Which slide each unit sits on, in display order — the form a move edits. */
  const slideOfUnit = (id: string): number[] => {
    const out: number[] = []
    groupsOf(id).forEach((g, gi) => {
      for (let k = 0; k < g; k++) out.push(gi)
    })
    return out
  }

  /**
   * Move a line to sit before display position `to`, joining the slide on the
   * `join` side of that seam.
   *
   * The line joins the slide it was dropped into and every other line stays
   * where it was — so dragging one line never shuffles its neighbours onto
   * different slides. That means carrying each unit's slide with it and
   * re-counting afterwards, rather than keeping the slide sizes fixed and
   * letting the contents slide along underneath.
   */
  const moveUnit = (id: string, from: number, to: number, join: Join): void => {
    const total = unitsOf(id).length
    const seats = slideOfUnit(id)
    if (seats.length !== total || from < 0 || from >= total) return
    const at = to > from ? to - 1 : to

    const current = lineOrder[id] ?? Array.from({ length: total }, (_, i) => i)
    const next = current.slice()
    const [moved] = next.splice(from, 1)
    next.splice(at, 0, moved)

    const seated = seats.slice()
    seated.splice(from, 1)
    // Which slide it joins is the whole question on a seam: dropped under a
    // heading it takes the slide it now sits at the top of, dropped above one it
    // takes the slide it now sits at the bottom of. Away from a seam both
    // neighbours are the same slide, so the answer is the same either way.
    seated.splice(
      at,
      0,
      join === 'below' ? (seated[at] ?? seated[at - 1] ?? 0) : at > 0 ? seated[at - 1] : (seated[at] ?? 0)
    )

    // Slides stay contiguous through both splices, so a run length per slide is
    // the whole grouping. An emptied slide simply has no run and disappears.
    const counts: number[] = []
    let run = 0
    for (let i = 0; i < seated.length; i++) {
      run++
      if (i === seated.length - 1 || seated[i + 1] !== seated[i]) {
        counts.push(run)
        run = 0
      }
    }

    // Landing back in the same place can still be a real edit — a line dropped
    // across the seam it was already beside keeps its position and changes
    // slide — so this compares the outcome rather than the index.
    const was = groupsOf(id)
    if (
      next.every((v, i) => v === current[i]) &&
      counts.length === was.length &&
      counts.every((c, i) => c === was[i])
    )
      return

    setLineOrder((prev) => ({ ...prev, [id]: next }))
    setGroups((prev) => ({ ...prev, [id]: counts }))
  }

  // --- hold and move -------------------------------------------------------
  // A press that stays put for a moment lifts the line; a press that moves
  // first is the operator scrolling the sheet and must be left alone.
  const listRef = useRef<HTMLDivElement | null>(null)
  const holdRef = useRef<{ sec: string; index: number; x: number; y: number; el: HTMLElement; pid: number } | null>(null)
  const timerRef = useRef<number | null>(null)
  const draggingRef = useRef(false)
  /** a press that lifted a line is a move, never a tap */
  const liftedRef = useRef(false)
  const frameRef = useRef<number | null>(null)
  const pointerY = useRef(0)

  const endHold = (): void => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    const h = holdRef.current
    if (h?.el.hasPointerCapture?.(h.pid)) h.el.releasePointerCapture(h.pid)
    holdRef.current = null
    draggingRef.current = false
    setDrag(null)
  }
  useEffect(() => endHold, [])

  // While a line is held, the finger is moving the line and not the sheet. The
  // listener has to be non-passive to say so, which React's onTouchMove is not.
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const hold = (e: TouchEvent): void => {
      if (draggingRef.current) e.preventDefault()
    }
    el.addEventListener('touchmove', hold, { passive: false })
    return () => el.removeEventListener('touchmove', hold)
  }, [editing])

  /**
   * Where a drop at this height would land, and which slide it would join.
   *
   * The "Slide 2" heading is the seam made visible, so it is what the drop reads
   * against: above the heading is the end of slide 1, below it the start of
   * slide 2. Aiming at a ~20px band is coarse for a finger, but it is the only
   * thing on screen that marks the difference, and the alternative — one drop
   * point that always means "end of the slide above" — leaves the top of a slide
   * unreachable in a single move.
   */
  const dropTarget = (clientY: number): { to: number; join: Join } => {
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-unit]') ?? [])]
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect()
      const heading = rows[i].querySelector<HTMLElement>('[data-slide-head]')
      const lyricTop = heading ? heading.getBoundingClientRect().bottom : r.top
      // Over the heading itself: the seam above it.
      if (heading && clientY < lyricTop) return { to: i, join: 'above' }
      if (clientY < lyricTop + (r.bottom - lyricTop) / 2) return { to: i, join: heading ? 'below' : 'above' }
    }
    return { to: rows.length, join: 'above' }
  }

  // A long stanza is taller than the sheet, so a line has to be able to travel
  // past what is on screen: held near an edge, the sheet comes to meet it.
  const creep = (): void => {
    const box = listRef.current?.closest('.sheet-scroll') as HTMLElement | null
    if (!draggingRef.current || !box) {
      frameRef.current = null
      return
    }
    const r = box.getBoundingClientRect()
    const edge = 56
    const above = pointerY.current - r.top
    const below = r.bottom - pointerY.current
    const step = above < edge ? -Math.ceil((edge - above) / 5) : below < edge ? Math.ceil((edge - below) / 5) : 0
    if (step) {
      const was = box.scrollTop
      box.scrollTop += step
      if (box.scrollTop !== was) {
        const t = dropTarget(pointerY.current)
        setDrag((d) => (d && (d.to !== t.to || d.join !== t.join) ? { ...d, ...t } : d))
      }
    }
    frameRef.current = requestAnimationFrame(creep)
  }

  const onLinePointerDown = (sec: string, index: number, e: ReactPointerEvent<HTMLElement>): void => {
    const el = e.currentTarget
    const pid = e.pointerId
    holdRef.current = { sec, index, x: e.clientX, y: e.clientY, el, pid }
    liftedRef.current = false
    pointerY.current = e.clientY
    timerRef.current = window.setTimeout(() => {
      draggingRef.current = true
      liftedRef.current = true
      try {
        el.setPointerCapture(pid)
      } catch {
        /* a pointer that already went away */
      }
      navigator.vibrate?.(8)
      setDrag({ sec, from: index, to: index, join: 'above' })
      frameRef.current = requestAnimationFrame(creep)
    }, 280)
  }

  const onLinePointerMove = (e: ReactPointerEvent<HTMLElement>): void => {
    const h = holdRef.current
    if (!h) return
    pointerY.current = e.clientY
    if (!draggingRef.current) {
      // Moving before the line lifts means this was a scroll all along.
      if (Math.abs(e.clientY - h.y) > 8 || Math.abs(e.clientX - h.x) > 8) endHold()
      return
    }
    const t = dropTarget(e.clientY)
    setDrag((d) => (d && (d.to !== t.to || d.join !== t.join) ? { ...d, ...t } : d))
  }

  const onLinePointerUp = (): void => {
    const h = holdRef.current
    if (draggingRef.current && drag && h) moveUnit(h.sec, drag.from, drag.to, drag.join)
    endHold()
  }

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
  const structure: SongStructure = {
    includedIds: includedInOrder,
    recurringId: recurring,
    groups,
    order: lineOrder
  }
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
            {confirmVerb} {slideCount} slide{slideCount === 1 ? '' : 's'}
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
          const slides = groupsOf(id).length
          const units = unitsOf(id)
          const breaks = breaksOf(id)
          return (
            <div key={id}>
            <div className={`list-row gap-2 ${on ? '' : 'opacity-45'}`}>
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
              <button
                className={`flex-none rounded-full px-2 py-1 text-[11px] font-semibold ${
                  editing === id ? 'bg-navy-700 text-white' : 'bg-black/5 text-ink-muted'
                } disabled:opacity-40`}
                disabled={!on}
                onClick={() => setEditing(editing === id ? null : id)}
                title="Choose which lines share a slide"
              >
                {slides} slide{slides === 1 ? '' : 's'}
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

            {editing === id && (
              <div ref={listRef} className="border-t border-black/5 bg-black/[0.02] px-3 py-2">
                <p className="mb-2 text-[12px] text-ink-muted">
                  Tap a line to start a new slide there, or hold and drag it somewhere else — drop it just under a{' '}
                  <b>Slide</b> heading to make it that slide’s first line.
                  {bilingual && ' A Telugu line and its transliteration always stay together.'}
                </p>
                {units.map((u, ui) => {
                  const isBreak = ui === 0 || breaks.has(ui)
                  const slideNo = [...breaks].filter((b) => b <= ui).length + 1
                  const held = drag?.sec === id && drag.from === ui
                  // The drop mark is a border on the row it would land above, so
                  // nothing shifts under the finger while it is being aimed. On a
                  // slide's first line the mark sits above OR below its heading,
                  // which is what says which slide the line is about to join.
                  const aiming = drag?.sec === id && drag.to === ui
                  const dropAbove = aiming && drag.join === 'above'
                  const dropUnderHead = aiming && drag.join === 'below'
                  const dropBelow = drag?.sec === id && drag.to === units.length && ui === units.length - 1
                  return (
                    <button
                      key={ui}
                      data-unit={ui}
                      className={`block w-full touch-pan-y select-none border-y-2 border-transparent text-left transition-opacity ${
                        dropAbove ? '!border-t-gold-500' : ''
                      } ${dropBelow ? '!border-b-gold-500' : ''} ${held ? 'opacity-40' : ''}`}
                      onPointerDown={(e) => onLinePointerDown(id, ui, e)}
                      onPointerMove={onLinePointerMove}
                      onPointerUp={onLinePointerUp}
                      onPointerCancel={endHold}
                      onContextMenu={(e) => e.preventDefault()}
                      onClick={() => {
                        // A press that lifted the line was a move, not a tap.
                        if (liftedRef.current) {
                          liftedRef.current = false
                          return
                        }
                        if (ui > 0) toggleBreak(id, ui)
                      }}
                    >
                      {isBreak && (
                        <span
                          data-slide-head
                          className="mt-1.5 block py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted first:mt-0"
                        >
                          Slide {slideNo}
                        </span>
                      )}
                      <span
                        className={`flex items-center gap-1.5 rounded-md border-t-2 border-transparent px-2 py-1 text-[13px] leading-snug ${
                          dropUnderHead ? '!border-t-gold-500' : ''
                        } ${held ? 'bg-navy-700/10 ring-1 ring-navy-700/25' : isBreak && ui > 0 ? 'bg-gold-500/15' : ''}`}
                      >
                        <span className="min-w-0 flex-1">
                          {unitLines(u).map((l, li) => (
                            <span key={li} className={`block truncate ${li >= u.lines.length ? 'text-ink-muted' : ''}`}>
                              {l}
                            </span>
                          ))}
                        </span>
                        <Icon name="grip" size={14} className="flex-none text-ink-muted/50" />
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
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
