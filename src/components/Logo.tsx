import { useId } from 'react'

/**
 * The Telugu Community Church mark — a closed book (Scripture) carrying a Latin
 * cross, with a TCC roundel at the intersection. Ported verbatim from the OBS
 * stream footer (tcc-stream-overlay/tcc-overlay.html) so the broadcast, the app
 * and the installed icon all show the same logo.
 *
 * Full-colour and self-contained: unlike the line glyph it replaces, this does
 * NOT take `currentColor`, so it can't be tinted by a parent. Size it with a
 * className — the artwork is taller than it is wide (63.5 × 77.5), so a square
 * box just centres it.
 *
 * `detail={false}` drops the inner ring and the "TCC" microtype, which turn to
 * mush below ~28px. Use it for small decorative marks; keep the default
 * anywhere the logo is doing real brand work.
 */
export function Logo({
  className,
  detail = true,
  title = 'Telugu Community Church'
}: {
  className?: string
  detail?: boolean
  title?: string
}): JSX.Element {
  // useId() emits colons, which break an `url(#…)` reference — strip them.
  const gid = `tcc-${useId().replace(/:/g, '')}`

  return (
    <svg viewBox="19.5 12.5 63.5 77.5" className={className} role="img" aria-label={title}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6aa8ea" />
          <stop offset="1" stopColor="#2f6bc4" />
        </linearGradient>
      </defs>

      {/* closed book, front cover facing the viewer */}
      <rect x="22.5" y="15.5" width="60" height="74" rx="5" fill="#d7e6f7" />
      <rect x="20" y="13" width="60" height="74" rx="5" fill={`url(#${gid})`} />
      <path d="M26 15.5 V84.5" stroke="#0e2440" strokeWidth="1.6" opacity=".22" strokeLinecap="round" />

      {/* Latin cross (crossbar ~30% from the top) with a blue border */}
      <path
        d="M47.25 18 H52.75 V35.25 H73 V40.75 H52.75 V84 H47.25 V40.75 H27 V35.25 H47.25 Z"
        fill="#f4f1e8"
        stroke="#2f6bc4"
        strokeWidth="1"
        strokeLinejoin="round"
      />

      {/* intersection: bordered ivory disc + inner ring + TCC */}
      <circle cx="50" cy="38" r="9" fill="#f4f1e8" stroke="#2f6bc4" strokeWidth="1" />
      {detail && (
        <>
          <circle cx="50" cy="38" r="6.4" fill="none" stroke="#2f6bc4" strokeWidth="1" />
          <text
            x="50"
            y="38.6"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#2f6bc4"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="800"
            fontSize="5.6"
            letterSpacing="0.06"
          >
            TCC
          </text>
        </>
      )}
    </svg>
  )
}

/**
 * The mark on an ivory disc, for dark surfaces. The logo is blue, so it needs a
 * light backing to carry contrast — on paper backgrounds use bare <Logo/>.
 *
 * Badges run 40–48px, which puts the roundel at ~7px, so `detail` is off by
 * default here; pass it explicitly only on an unusually large badge.
 */
export function LogoBadge({
  className = 'h-11 w-11',
  detail = false
}: {
  className?: string
  detail?: boolean
}): JSX.Element {
  return (
    <span className={`grid flex-none place-items-center rounded-full bg-[#f4f1e8] ring-1 ring-inset ring-navy-900/10 ${className}`}>
      <Logo className="h-[70%] w-[70%]" detail={detail} />
    </span>
  )
}
