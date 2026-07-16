import type { Background, Slide } from './relay'

// Fallback worship backdrop when no reachable background is set.
export const DEFAULT_BG = 'radial-gradient(circle at 50% 28%, #2a2350 0%, #150f33 55%, #0a0720 100%)'

const NBSP = String.fromCharCode(0xa0)

/**
 * Tidy a lyric line for display. Collapses ragged runs of whitespace, then pins
 * any ||repeat|| marker (Telugu song-book notation) exactly TWO NON-BREAKING
 * spaces after the preceding lyric — so it never collapses to one space, never
 * grows a ragged gap, and never wraps onto its own line (nbsp doesn't break or
 * collapse). A standalone marker line (no lyric before it) is left as-is. Mirrors
 * the desktop composer's single-line look in the live + OBS views.
 */
export function formatLyric(line: string): string {
  return line
    .replace(/[ \t]+/g, ' ')
    .trim()
    .replace(/(\S) *(\|\|[^|]+\|\|)/g, '$1' + NBSP + NBSP + '$2')
}

export function textOf(slide?: Slide | null): string[] {
  if (!slide) return []
  if (slide.composed && slide.composed.length) return slide.composed.map((l) => formatLyric(l.text))
  return (slide.lines || []).map(formatLyric)
}

export function isTimer(slide?: Slide | null): boolean {
  return !!slide && (slide.kind === 'countdown' || slide.kind === 'clock')
}

/** Font size (container-query height units) by line count — matches obs.html. */
export function sizeFor(n: number, scale = 1): string {
  const s = n <= 1 ? 9 : n <= 2 ? 8 : n <= 3 ? 6.5 : n <= 4 ? 5.5 : n <= 6 ? 4.5 : 3.8
  return `${s * scale}cqh`
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}
export function fmtCountdown(toMs?: number): string {
  const ms = Math.max(0, (toMs || 0) - Date.now())
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`
}
export function fmtClock(): string {
  const d = new Date()
  const h = d.getHours()
  const m = d.getMinutes()
  const ap = h >= 12 ? 'PM' : 'AM'
  let h12 = h % 12
  if (h12 === 0) h12 = 12
  return `${h12}:${pad2(m)} ${ap}`
}

export type ResolvedBg = { kind: 'css'; value: string } | { kind: 'image' | 'video'; value: string }

/** Only http(s) media is reachable from the web; local media → the default backdrop. */
export function resolveBackground(bg?: Background | null): ResolvedBg {
  if (!bg) return { kind: 'css', value: DEFAULT_BG }
  if (bg.type === 'color' || bg.type === 'gradient') return { kind: 'css', value: bg.value }
  if (bg.type === 'image' && /^https?:/i.test(bg.value)) return { kind: 'image', value: bg.value }
  if (bg.type === 'video' && /^https?:/i.test(bg.value)) return { kind: 'video', value: bg.value }
  return { kind: 'css', value: DEFAULT_BG }
}
