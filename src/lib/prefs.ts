import { useCallback, useEffect, useState } from 'react'

/**
 * Small localStorage-backed preferences, so the app remembers how you like to
 * read between launches (which a native app would, and a website usually
 * doesn't). Reads are lazy and failure-tolerant — private-mode Safari throws on
 * localStorage access, and a reader setting is never worth crashing a screen.
 */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota or private mode — the setting just won't persist */
  }
}

export function usePref<T>(key: string, fallback: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => read(key, fallback))
  const set = useCallback(
    (next: T) => {
      setValue(next)
      write(key, next)
    },
    [key]
  )
  return [value, set]
}

// ---- reading text size (Bible + songbook) ----
export const READ_SIZES = [16, 17, 18, 19, 21, 23, 26] as const
export const DEFAULT_READ_STEP = 2 // → 18px

/** Shared text-size control state for the reading screens. */
export function useReadSize(): {
  size: number
  step: number
  setStep: (n: number) => void
  inc: () => void
  dec: () => void
  canInc: boolean
  canDec: boolean
} {
  const [step, setStep] = usePref('tcc-read-size', DEFAULT_READ_STEP)
  const clamped = Math.min(READ_SIZES.length - 1, Math.max(0, step))
  return {
    size: READ_SIZES[clamped],
    step: clamped,
    setStep,
    inc: () => setStep(Math.min(READ_SIZES.length - 1, clamped + 1)),
    dec: () => setStep(Math.max(0, clamped - 1)),
    canInc: clamped < READ_SIZES.length - 1,
    canDec: clamped > 0
  }
}

/** Remembers where you were reading, so the Bible reopens on that chapter. */
export interface BiblePlace {
  book: string
  chapter: number
}
export function useBiblePlace(): [BiblePlace, (p: BiblePlace) => void] {
  return usePref<BiblePlace>('tcc-bible-place', { book: 'Genesis', chapter: 1 })
}

/**
 * Horizontal swipe on a vertically-scrolling surface. Only fires when the
 * gesture is clearly sideways, so it never steals a scroll — the rule that
 * makes swipe navigation feel right instead of twitchy.
 */
export function useSwipe(
  el: HTMLElement | null,
  onSwipe: (dir: 'left' | 'right') => void,
  enabled = true
): void {
  useEffect(() => {
    if (!el || !enabled) return
    let x = 0
    let y = 0
    let tracking = false

    const start = (e: TouchEvent): void => {
      if (e.touches.length !== 1) {
        tracking = false
        return
      }
      x = e.touches[0].clientX
      y = e.touches[0].clientY
      tracking = true
    }
    const end = (e: TouchEvent): void => {
      if (!tracking) return
      tracking = false
      const t = e.changedTouches[0]
      const dx = t.clientX - x
      const dy = t.clientY - y
      // Sideways by at least 60px AND at least twice the vertical drift.
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return
      onSwipe(dx < 0 ? 'left' : 'right')
    }

    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchend', end, { passive: true })
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchend', end)
    }
  }, [el, onSwipe, enabled])
}
