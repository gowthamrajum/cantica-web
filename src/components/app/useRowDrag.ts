import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

/**
 * Drag a row to a new place in a list.
 *
 * By a HANDLE rather than by holding the row: these rows are mostly buttons —
 * tick, repeats, preview, remove — and a long-press anywhere on one would fight
 * every one of them. The handle is the part that does nothing else.
 *
 * The row under the finger is found from the point rather than from a hover: a
 * touch has no hover, and the finger is on top of the row it is aiming at.
 *
 * Written once and used by both lists that need it — the songs in a service and
 * the sections in a song — because the second copy of this is where the two
 * quietly start behaving differently.
 */
export interface RowDrag {
  /** The row being carried, or null. `to` is the row the mark sits ABOVE. */
  drag: { key: string; from: number; to: number } | null
  /** Spread onto the handle. */
  handleProps: (key: string, index: number) => {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void
    onPointerUp: () => void
    onPointerCancel: () => void
    onContextMenu: (e: { preventDefault: () => void }) => void
  }
  /** True for the row the drop mark belongs above. */
  aimingAt: (index: number) => boolean
  /** True for the LAST row when the drop lands after it — the mark goes below
   *  that row, there being no row after it to sit above. */
  aimingEnd: (index: number, total: number) => boolean
  /** True for the row being carried, so it can be faded. */
  carrying: (key: string) => boolean
}

export function useRowDrag(
  onMove: (from: number, to: number) => void,
  /** The attribute that marks a droppable row, so two lists can coexist. */
  attr = 'data-row-index'
): RowDrag {
  const [drag, setDrag] = useState<{ key: string; from: number; to: number } | null>(null)
  /**
   * The same thing in a ref.
   *
   * The drop has to read where the finger ended and then move the list, and
   * doing both inside a state updater does not work: React treats an updater as
   * pure and a setState called from within one is dropped, so the row was
   * released and nothing happened. The ref is what the handler reads; the state
   * exists only to redraw the drop mark.
   */
  const live = useRef<{ key: string; from: number; to: number } | null>(null)

  /**
   * Which slot the finger is over — including the one past the end.
   *
   * A hit test alone cannot answer "after the last row": below it there is no
   * row to hit, so the aim stopped at the last one and a section could not be
   * moved to the bottom. A miss therefore falls back to comparing the pointer
   * against the list's own rows — which also stops the aim escaping to a
   * DIFFERENT list, since the sheet floats over the service and both have rows.
   */
  const rowAt = (x: number, y: number): number | null => {
    const rows = [...document.querySelectorAll<HTMLElement>(`[${attr}]`)]
    if (!rows.length) return null

    const hit = document.elementFromPoint(x, y)?.closest(`[${attr}]`)
    if (hit && rows.includes(hit as HTMLElement)) {
      const n = Number((hit as HTMLElement).getAttribute(attr))
      return Number.isFinite(n) ? n : null
    }

    const first = rows[0].getBoundingClientRect()
    const last = rows[rows.length - 1].getBoundingClientRect()
    if (y >= last.bottom) return rows.length // past the end — drop at the bottom
    if (y <= first.top) return 0
    let best: number | null = null
    let bestD = Infinity
    for (const r of rows) {
      const b = r.getBoundingClientRect()
      const d = Math.abs(y - (b.top + b.height / 2))
      if (d < bestD) {
        bestD = d
        best = Number(r.getAttribute(attr))
      }
    }
    return best
  }

  return {
    drag,
    handleProps: (key, index) => ({
      onPointerDown: (e) => {
        // Stops the press becoming a scroll, and keeps the moves coming to this
        // element even once the finger has left it.
        e.preventDefault()
        e.currentTarget.setPointerCapture?.(e.pointerId)
        live.current = { key, from: index, to: index }
        setDrag(live.current)
      },
      onPointerMove: (e) => {
        const d = live.current
        if (!d) return
        const to = rowAt(e.clientX, e.clientY)
        if (to == null || to === d.to) return
        live.current = { ...d, to }
        setDrag(live.current)
      },
      onPointerUp: () => {
        const d = live.current
        live.current = null
        setDrag(null)
        if (!d || d.to === d.from) return
        /*
         * `to` is where the mark was drawn — an index into the list AS IT
         * STILL IS, with the carried row in it. Every caller then removes that
         * row before inserting, which shifts everything after it down by one,
         * so a downward move landed one place too far: dropping the first row
         * on the third put it AFTER the third, not above it.
         *
         * Corrected here rather than in each caller. This hook exists because
         * "the second copy of this is where the two quietly start behaving
         * differently" — and that is exactly what happened, twice, before a
         * third list made it obvious.
         */
        onMove(d.from, d.to > d.from ? d.to - 1 : d.to)
      },
      onPointerCancel: () => {
        live.current = null
        setDrag(null)
      },
      onContextMenu: (e) => e.preventDefault()
    }),
    aimingAt: (index) => !!drag && drag.to === index && drag.from !== index,
    aimingEnd: (index, total) => !!drag && drag.to >= total && index === total - 1 && drag.from !== index,
    carrying: (key) => drag?.key === key
  }
}
