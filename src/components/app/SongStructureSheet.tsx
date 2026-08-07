import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Sheet } from './Sheet'
import { useRowDrag } from './useRowDrag'
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
  /**
   * The running order as OCCURRENCES, not sections.
   *
   * A section may appear more than once — the refrain placed by hand where it
   * is wanted, a stanza sung twice — so a row is identified by its own key
   * rather than by the section it shows. Anything that used to key off the
   * section id would otherwise move, tick or delete every copy at once.
   */
  const [order, setOrder] = useState<{ key: string; id: string }[]>([])
  const [included, setIncluded] = useState<Set<string>>(new Set())
  const [recurring, setRecurring] = useState<string | null>(null)
  /** section id -> units per slide. Absent = however the automatic split falls. */
  const [groups, setGroups] = useState<Record<string, number[]>>({})
  /** section id -> the units' order, once a line has been moved. */
  const [lineOrder, setLineOrder] = useState<Record<string, number[]>>({})
  /** which section's slides are open for editing */
  const [editing, setEditing] = useState<string | null>(null)
  /** Distinguishes one copy of a section from the next; never reused. */
  const nextKey = useRef(0)
  /**
   * Whether the refrain's line list is open. Closed to begin with: the whole
   * refrain repeating is what almost every song wants, so the list is an answer
   * to a question most services never ask, and open by default it pushed the
   * stanzas below it off the screen.
   */
  const [pickingRepeat, setPickingRepeat] = useState(false)
  /** Armed once, so a tap that would throw the arrangement away asks first. */
  const [confirmReset, setConfirmReset] = useState(false)
  /**
   * Which units of the refrain come BACK between the stanzas. Empty means all of
   * it, which is what every arrangement did before this existed.
   */
  const [repeatUnits, setRepeatUnits] = useState<number[]>([])
  /**
   * The refrain's WHOLE appearances — the first time through and the close.
   *
   * A refrain often sings a line twice every time it is sung, not only when it
   * comes back, and the section's own order cannot say so: that is a strict
   * permutation, which is what lets it notice a saved order no longer matching
   * the song. So the whole one gets a sequence of its own, edited by the same
   * rows as the reprise with a switch above them.
   */
  const [wholeUnits, setWholeUnits] = useState<number[]>([])
  const [editingSeq, setEditingSeq] = useState<'whole' | 'reprise'>('reprise')
  /** Whether the last time round is the whole refrain — how a song usually ends. */
  const [fullAtEnd, setFullAtEnd] = useState(true)
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
    /**
     * Rebuild the running order with the LEFT-OUT sections back where they
     * belong.
     *
     * includedIds records only what plays, so reopening a song that had stanza 1
     * left out used to append it after the ones that were kept — and turning it
     * back on then played it last, in the wrong place, for good. The stanza had
     * not been moved; it had been dropped off the end of a list and pushed back
     * on.
     *
     * So each excluded section keeps its natural position and the included ones
     * take the saved order among themselves. A song nobody reordered comes back
     * exactly as it is written; one that WAS reordered keeps it.
     */
    nextKey.current = 0
    const mint = (id: string): { key: string; id: string } => ({ key: `${id}#${nextKey.current++}`, id })

    /**
     * Rebuild the rows from the saved arrangement, keeping every appearance.
     *
     * `kept` is the play order and may name a section more than once — a refrain
     * placed by hand, a stanza sung twice — so it is walked as it stands rather
     * than reduced to a set. Sections it never mentions were left out, and each
     * goes back at its natural position, unticked: it was not moved, it was
     * simply not playing.
     */
    const rows = kept?.length ? kept.map(mint) : all.map(mint)
    const on = new Set(rows.map((r) => r.key))
    if (kept?.length) {
      for (const [i, id] of all.entries()) {
        if (kept.includes(id)) continue
        // Its natural neighbour is the section before it that IS in the order.
        const before = all.slice(0, i).filter((x) => kept.includes(x)).pop()
        const at = before ? rows.findIndex((r) => r.id === before) + 1 : 0
        rows.splice(at, 0, mint(id))
      }
    }
    setOrder(rows)
    setIncluded(on)
    const rec = initial ? (initial.recurringId ?? null) : detectRecurringSection(sections)
    setRecurring(rec)
    setGroups(initial?.groups ?? {})
    setLineOrder(initial?.order ?? {})
    // Everything ticked unless a narrower choice was saved. An arrangement made
    // before this existed has no repeatUnits and repeated the refrain whole, so
    // all-ticked is both the right default and the truth about that song.
    const recSec = rec ? sections.find((x) => x.id === rec) : null
    const recUnits = recSec
      ? sectionUnits(recSec.lines.filter((l) => l && l.trim()), lang === 'both').length
      : 0
    const written = Array.from({ length: recUnits }, (_, k) => k)
    setRepeatUnits(initial?.repeatUnits?.length ? initial.repeatUnits : written)
    setWholeUnits(initial?.wholeUnits?.length ? initial.wholeUnits : written)
    setEditingSeq('reprise')
    setPickingRepeat(false)
    setFullAtEnd(initial?.repeatFullAtEnd !== false)
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

  /** The sequence the rows are editing, and the way to change it. */
  const seq = editingSeq === 'whole' ? wholeUnits : repeatUnits
  const setSeq = editingSeq === 'whole' ? setWholeUnits : setRepeatUnits
  /** Is `q` the section exactly as written — same lines, same order, no repeat? */
  const asWritten = (id: string, q: number[]): boolean => {
    const n = unitsOf(id).length
    return q.length === n && q.every((v, i) => v === i)
  }

  /**
   * Does the reprise say the section exactly as written?
   *
   * Not just "are they all here" — the same lines reordered, or one of them
   * twice, is a different thing coming back, and it is the answer to this that
   * decides whether closing on the whole refrain has anything to add.
   */
  const repeatsWhole = (id: string): boolean => {
    const n = unitsOf(id).length
    return repeatUnits.length === n && repeatUnits.every((v, i) => v === i)
  }
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

  const includedInOrder = order.filter((o) => included.has(o.key)).map((o) => o.id)

  const toggle = (key: string): void => (
    setConfirmReset(false),
    setIncluded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  )

  /**
   * Back to the song as it is written: every section, in order, nothing
   * duplicated, the refrain guessed afresh.
   *
   * An arrangement can be got into a state nobody wants — everything unticked,
   * copies made and moved until it no longer resembles the song — and until now
   * the only way out was to leave without saving and start the pick again. This
   * is the way back.
   */
  const resetToWritten = (): void => {
    nextKey.current = 0
    const rows = sections.map((sec) => ({ key: `${sec.id}#${nextKey.current++}`, id: sec.id }))
    setOrder(rows)
    setIncluded(new Set(rows.map((r) => r.key)))
    const rec = detectRecurringSection(sections)
    setRecurring(rec)
    const recSec = rec ? sections.find((x) => x.id === rec) : null
    setRepeatUnits(
      recSec
        ? sectionUnits(recSec.lines.filter((l) => l && l.trim()), lang === 'both').map((_, k) => k)
        : []
    )
    setFullAtEnd(true)
    setGroups({})
    setLineOrder({})
    setEditing(null)
    setConfirmReset(false)
  }

  const rowDrag = useRowDrag(
    (from, to) =>
      setOrder((prev) => {
        const next = prev.slice()
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        return next
      }),
    // Its own attribute: this sheet floats over the service's draggable list,
    // and a shared one let the aim fall through to the songs underneath.
    'data-section-row'
  )

  /**
   * Dragging inside the reprise — its own list, its own attribute.
   *
   * The sheet already carries two draggable lists (the service's songs
   * underneath, the sections here); a third sharing an attribute would let the
   * aim fall through to whichever one the finger happened to be over.
   */
  // Read through a ref so the drag that is already in flight moves the list the
  // finger actually started on, not whichever one a re-render left behind.
  const seqRef = useRef(editingSeq)
  seqRef.current = editingSeq
  const repeatDrag = useRowDrag(
    (from, to) =>
      (seqRef.current === 'whole' ? setWholeUnits : setRepeatUnits)((prev) => {
        const next = prev.slice()
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        return next
      }),
    'data-repeat-row'
  )

  /** Another go at the same section, dropped in right below this one and ready
   *  to be moved wherever it is actually wanted. */
  const duplicate = (key: string): void => {
    // Everything decided BEFORE the updater. An updater has to be pure — React
    // may run it more than once — so minting a key inside one burns two, and a
    // setState made from within one is dropped. Both were happening here.
    const i = order.findIndex((o) => o.key === key)
    if (i < 0) return
    const copy = { key: `${order[i].id}#${nextKey.current++}`, id: order[i].id }
    setOrder((prev) => {
      const next = prev.slice()
      next.splice(i + 1, 0, copy)
      return next
    })
    setIncluded((inc) => new Set(inc).add(copy.key))
  }

  /** Take a copy away. The first appearance of a section is not a copy — that
   *  one is unticked instead, which is what leaving it out has always meant. */
  const removeCopy = (key: string): void => {
    if (!order.some((o) => o.key === key)) return
    setOrder((prev) => prev.filter((o) => o.key !== key))
    setIncluded((inc) => {
      const n = new Set(inc)
      n.delete(key)
      return n
    })
  }

  // The real arrangement and the real slide count, from the same functions the
  // export uses — so what this promises is what lands in Cantica.
  const structure: SongStructure = {
    includedIds: includedInOrder,
    recurringId: recurring,
    groups,
    order: lineOrder,
    repeatUnits,
    wholeUnits,
    repeatFullAtEnd: fullAtEnd
  }
  /**
   * The running order exactly as it will play.
   *
   * Built with the SAME closing-refrain option songToItem computes, because it
   * was built without one — so a song whose reprise is a few lines ended its
   * summary a refrain early: the line said "… Stanza 4 → Stanza 1" while the
   * slides went reprise, then the whole thing. The footer's slide count was
   * right the whole time, which is what made the disagreement hard to see.
   */
  const repriseIsPart = !!recurring && repeatUnits.length > 0 && !repeatsWhole(recurring)
  const playOrder = buildSongArrangement(sections, includedInOrder, recurring, {
    closeWithRefrain: repriseIsPart && fullAtEnd
  })
  /**
   * Which appearances are the shortened reprise rather than the whole refrain —
   * the same rule the slides use: the first time is whole, and so is the last
   * unless the operator turned that off.
   */
  const recurringAt = recurring ? playOrder.reduce<number[]>((a, id, i) => (id === recurring ? [...a, i] : a), []) : []
  const lastWhole = fullAtEnd ? recurringAt[recurringAt.length - 1] ?? -1 : -1
  /**
   * What to say about one appearance of the refrain — and it has to follow the
   * builder's own rule, not an approximation of it.
   *
   * An earlier go marked every appearance the moment either sequence was
   * touched, so copying a line into the FIRST-and-last shape labelled the
   * reprises in between as changed when they were still the section as written.
   * The two shapes are chosen per appearance, so the note is too.
   */
  const wholeIsCustom = !!recurring && wholeUnits.length > 0 && !asWritten(recurring, wholeUnits)
  const noteAt = (i: number): string => {
    if (!recurring || playOrder[i] !== recurring) return ''
    const isWholeOne = i === recurringAt[0] || i === lastWhole
    if (isWholeOne) return wholeIsCustom ? ' (changed)' : ''
    return repriseIsPart ? repriseNote() : ''
  }

  /**
   * What to call a reprise that isn't the refrain as written.
   *
   * "part" is only true when it is fewer lines. Copy a line and the reprise is
   * LONGER than the refrain, and reordering makes it neither longer nor shorter
   * — calling either of those a part of the refrain is simply false.
   */
  const repriseNote = (): string =>
    recurring && repeatUnits.length < unitsOf(recurring).length ? ' (part)' : ' (changed)'
  /** Sections of the song that no longer appear anywhere in the running order. */
  const missing = sections.filter((sec) => !includedInOrder.includes(sec.id))
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
        Untick a stanza to leave it out. Tick <b>repeats</b> on the one that comes back between the
        others — usually the Pallavi — and tick it again to stop it.
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
        {order.map(({ key, id }, idx) => {
          const sec = byId.get(id)
          if (!sec) return null
          const on = included.has(key)
          const first = sec.lines.find((l) => l.trim()) ?? '—'
          const slides = groupsOf(id).length
          const units = unitsOf(id)
          const breaks = breaksOf(id)
          // Which go this is, so two copies of one stanza can be told apart.
          const copies = order.filter((o) => o.id === id)
          const nth = copies.findIndex((o) => o.key === key) + 1
          const isCopy = copies.length > 1
          // The drop mark is a border on the row it would land above, so nothing
          // shifts under the finger while it is being aimed.
          const dragging = rowDrag.carrying(key)
          const aiming = rowDrag.aimingAt(idx)
          const aimingEnd = rowDrag.aimingEnd(idx, order.length)
          return (
            <div
              key={key}
              data-section-row={idx}
              className={`border-y-2 border-transparent ${aiming ? '!border-t-gold-500' : ''} ${
                aimingEnd ? '!border-b-gold-500' : ''
              } ${dragging ? 'opacity-40' : ''}`}
            >
            <div className={`list-row gap-2 ${on ? '' : 'opacity-45'}`}>
              <button className="icon-btn flex-none" onClick={() => toggle(key)} aria-label={on ? 'Leave out' : 'Include'}>
                <Icon name={on ? 'check' : 'plus'} size={17} />
              </button>
              <span className="min-w-0 flex-1">
                <span className="list-title block">
                  {sec.label}
                  {isCopy && <span className="ml-1.5 text-[11px] font-semibold text-ink-muted">#{nth}</span>}
                </span>
                <span className="list-sub block truncate">{first}</span>
              </span>
              {/* A checkbox, not a one-way switch: tapping the marked one
                  clears it. It only ever SET the repeat before, so the way to
                  undo was to scroll up to "Nothing repeats" — which is not
                  where anyone looks for the opposite of a button they just
                  pressed. Still one at a time; a song has one refrain. */}
              <button
                className={`flex flex-none items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${
                  recurring === id ? 'bg-gold-500 text-white' : 'bg-black/5 text-ink-muted'
                } disabled:opacity-40`}
                disabled={!on}
                aria-pressed={recurring === id}
                title={recurring === id ? 'Stop this one repeating' : 'Play this one between the others'}
                onClick={() => {
                  const next = recurring === id ? null : id
                  void 0
                  setRecurring(next)
                  // A selection is a set of positions INSIDE one section; it
                  // means nothing against a different one.
                  // Marking a section as the refrain ticks all of its lines:
                  // the whole thing repeats until somebody says otherwise, and
                  // an empty list would read as "nothing repeats".
                  // BOTH sequences, not just the reprise: a sequence left
                  // over from the section that used to be the refrain has the
                  // wrong number of lines in it, and every appearance then
                  // reads as changed when nothing has been touched.
                  const written = next ? unitsOf(next).map((_, k) => k) : []
                  setRepeatUnits(written)
                  setWholeUnits(written)
                  setEditingSeq('reprise')
                  setFullAtEnd(true)
                  setPickingRepeat(false)
                }}
              >
                <Icon name={recurring === id ? 'check' : 'plus'} size={12} strokeWidth={3} />
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
              {/* Another go at this section, to be dragged where it is wanted —
                  a refrain placed by hand, a stanza sung twice. A copy can be
                  taken away again; the first appearance is unticked instead,
                  which is what leaving a section out has always meant. */}
              <button
                className="icon-btn flex-none"
                onClick={() => (isCopy && nth > 1 ? removeCopy(key) : duplicate(key))}
                aria-label={isCopy && nth > 1 ? `Remove this copy of ${sec.label}` : `Add another ${sec.label}`}
                title={isCopy && nth > 1 ? 'Remove this copy' : 'Another go at this one — then drag it where you want'}
              >
                <Icon name={isCopy && nth > 1 ? 'close' : 'copy'} size={16} />
              </button>
              {/* Drag it where it goes. The buttons it replaces walked a
                  section one step per tap, which for a song of eight sections
                  is eight taps to move something to the top. */}
              <button
                className="icon-btn flex-none cursor-grab touch-none active:cursor-grabbing"
                {...rowDrag.handleProps(key, idx)}
                aria-label={`Move ${sec.label}`}
                title="Drag to move"
              >
                <Icon name="grip" size={17} />
              </button>
            </div>

            {/* The refrain's lines, ticked. Shown as soon as a section is
                marked — the question "which of these come back?" only exists
                once it is the refrain, and hiding it behind a summary row made
                it something to go and find rather than something to answer. */}
            {recurring === id && on && (
              <div className="border-t border-black/5 bg-gold-500/[0.06] px-3 py-2">
                <button
                  className="flex w-full items-center gap-2 py-0.5 text-left"
                  onClick={() => setPickingRepeat((v) => !v)}
                  aria-expanded={pickingRepeat}
                >
                  <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-ink">
                    How the refrain is sung{' '}
                    <span className="font-normal text-ink-muted">
                      {asWritten(id, wholeUnits) && repeatsWhole(id)
                        ? '· as written'
                        : `· ${wholeUnits.length} then ${repeatUnits.length}`}
                    </span>
                  </span>
                  <Icon
                    name="chevron"
                    size={15}
                    strokeWidth={2.4}
                    className={`flex-none text-ink-muted transition-transform ${pickingRepeat ? 'rotate-90' : ''}`}
                  />
                </button>
                {pickingRepeat && (
                <>
                {/* The refrain is sung in two shapes and they are edited by
                    the same rows, because they are the same question asked of
                    two moments. Two separate lists of identical controls, one
                    above the other, would read as four times the work. */}
                <div className="mb-1.5 mt-1 flex gap-1 rounded-lg bg-black/[0.04] p-0.5">
                  {([
                    ['whole', 'First & last'],
                    ['reprise', 'Between stanzas']
                  ] as const).map(([k, label]) => (
                    <button
                      key={k}
                      className={`flex-1 rounded-md px-2 py-1 text-[12px] font-semibold ${
                        editingSeq === k ? 'bg-white text-ink shadow-sm' : 'text-ink-muted'
                      }`}
                      onClick={() => setEditingSeq(k)}
                      aria-pressed={editingSeq === k}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mb-1.5 text-[12px] leading-relaxed text-ink-muted">
                  {editingSeq === 'whole'
                    ? 'The refrain the first time through, and again to close.'
                    : 'The refrain as it comes back after each stanza.'}{' '}
                  Drag to reorder, copy a line to sing it twice, remove what shouldn’t be there.
                  {bilingual && ' A Telugu line and its transliteration are one — they move together.'}
                </p>

                {/* One way back, at the top, rather than a plus beside every
                    line of the stanza. A list of every line to re-add is the
                    same list again, twice as long, and it is only ever wanted
                    after a removal that was not meant — so it appears only once
                    something has actually gone. */}
                {!asWritten(id, seq) && (
                  <button
                    className="mb-1.5 flex w-full items-center gap-1.5 rounded-lg bg-gold-500/10 px-2 py-1.5 text-left"
                    onClick={() => setSeq(unitsOf(id).map((_, k) => k))}
                  >
                    <Icon name="back" size={14} strokeWidth={2.4} className="flex-none text-gold-600" />
                    <span className="text-[12.5px] font-semibold text-gold-600">Put the whole refrain back</span>
                  </button>
                )}

                {seq.map((ui, at) => {
                  const u = unitsOf(id)[ui]
                  if (!u) return null
                  // A refrain of nothing is not an arrangement, it is a mistake.
                  const lastOne = seq.length === 1
                  const aiming = repeatDrag.aimingAt(at)
                  const aimingEnd = repeatDrag.aimingEnd(at, seq.length)
                  return (
                    <div
                      key={`${ui}-${at}`}
                      data-repeat-row={at}
                      className={`flex items-start gap-1.5 border-y-2 border-transparent py-1 ${
                        aiming ? '!border-t-gold-500' : ''
                      } ${aimingEnd ? '!border-b-gold-500' : ''} ${
                        repeatDrag.carrying(`${ui}-${at}`) ? 'opacity-40' : ''
                      }`}
                    >
                      <span
                        className="-m-1 flex-none cursor-grab touch-none p-1 text-ink-muted"
                        aria-label="Drag to reorder"
                        {...repeatDrag.handleProps(`${ui}-${at}`, at)}
                      >
                        <Icon name="grip" size={15} />
                      </span>
                      <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink">
                        {unitLines(u).map((l, li) => (
                          <span key={li} className="block truncate">
                            {l}
                          </span>
                        ))}
                      </span>
                      {/* The copy lands directly under the line it came from,
                          which is where "sing that again" belongs. */}
                      <button
                        className="-m-1 flex-none p-1 text-ink-muted"
                        aria-label="Sing this line again"
                        title="Sing this line again"
                        onClick={() =>
                          setSeq((prev) => {
                            const next = prev.slice()
                            next.splice(at + 1, 0, ui)
                            return next
                          })
                        }
                      >
                        <Icon name="copy" size={15} />
                      </button>
                      <button
                        className="-m-1 flex-none p-1 text-ink-muted disabled:opacity-30"
                        aria-label="Don’t bring this line back"
                        disabled={lastOne}
                        title={lastOne ? 'At least one line has to come back' : undefined}
                        onClick={() => setSeq((prev) => prev.filter((_, i) => i !== at))}
                      >
                        <Icon name="close" size={15} />
                      </button>
                    </div>
                  )
                })}

                {/* Only once something has been left out is there anything for a
                    full refrain at the end to be different from. */}
                {!repeatsWhole(id) && (
                  <button
                    className="mt-2 flex w-full items-start gap-2 border-t border-black/5 pt-2 text-left"
                    onClick={() => setFullAtEnd((v) => !v)}
                    aria-pressed={fullAtEnd}
                  >
                    <span
                      className={`mt-[2px] grid h-[18px] w-[18px] flex-none place-items-center rounded-[5px] border ${
                        fullAtEnd ? 'border-gold-500 bg-gold-500 text-white' : 'border-ink-muted/40 text-transparent'
                      }`}
                    >
                      <Icon name="check" size={12} strokeWidth={3.2} />
                    </span>
                    <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-ink">
                      Close on the whole refrain
                      <span className="block text-ink-muted">
                        After the last stanza: the ticked lines as usual, then all of it once more to finish.
                      </span>
                    </span>
                  </button>
                )}
                </>
                )}
              </div>
            )}

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

      {/* Only when something of the song is actually missing from the order —
          left out, or a copy removed until none is playing. Offering a reset
          against an arrangement that has lost nothing is offering to undo work
          for no reason. */}
      {missing.length > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 px-3.5 py-3">
          <p className="text-[13px] leading-relaxed text-amber-800">
            {missing.length === sections.length ? (
              <>Nothing from this song is playing.</>
            ) : (
              <>
                Not playing: <b>{missing.map((sec) => sec.label).join(', ')}</b>.
              </>
            )}{' '}
            {confirmReset ? 'This throws away the arrangement — tap again to go back to the song as written.' : ''}
          </p>
          <button
            className={`mt-2 text-[12.5px] font-semibold ${confirmReset ? 'text-red-600' : 'text-amber-800 underline'}`}
            onClick={() => (confirmReset ? resetToWritten() : setConfirmReset(true))}
          >
            {confirmReset ? 'Yes — reload the song' : 'Reload the song'}
          </button>
        </div>
      )}

      <p className="mt-3 text-[13px] text-ink-muted">
        <b>Plays as:</b>{' '}
        {playOrder.length
          ? playOrder
              .map((id, i) => `${byId.get(id)?.label ?? id}${noteAt(i)}`)
              .join(' → ')
          : 'nothing selected'}
      </p>
    </Sheet>
  )
}
