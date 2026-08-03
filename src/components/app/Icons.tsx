import type { SVGProps } from 'react'

/**
 * One stroked 24×24 icon set for the whole app, so every glyph shares a weight
 * and optical size.
 *
 * `active` thickens the stroke rather than swapping to a solid variant: these
 * glyphs carry interior detail (the play triangle, the cross on the Bible), and
 * filling them collapses that detail into a blob. Selection is carried by the
 * gold pill and navy tint behind the icon instead.
 */
export type IconName =
  | 'home'
  | 'watch'
  | 'bible'
  | 'songs'
  | 'more'
  | 'chevron'
  | 'back'
  | 'close'
  | 'search'
  | 'give'
  | 'pin'
  | 'calendar'
  | 'globe'
  | 'people'
  | 'text'
  | 'external'
  | 'check'
  | 'eye'
  | 'remote'
  | 'plus'
  | 'minus'
  | 'info'
  | 'sparkle'
  | 'gear'
  | 'offering'
  | 'communion'
  | 'grip'

type Props = SVGProps<SVGSVGElement> & { name: IconName; size?: number; active?: boolean }

export function Icon({ name, size = 22, active = false, ...rest }: Props): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.15 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}

const PATHS: Record<IconName, JSX.Element> = {
  // A lancet-arch church door — echoes the TCC emblem rather than a generic house.
  home: (
    <>
      <path d="M3 10.6 12 3l9 7.6" />
      <path d="M5 10v10.5h14V10" />
      <path d="M9.2 20.5v-6a2.8 2.8 0 0 1 5.6 0v6" />
    </>
  ),
  watch: (
    <>
      <rect x="2.5" y="4.5" width="19" height="13" rx="2.6" />
      <path d="M10.2 8.6l4.6 2.4-4.6 2.4z" />
      <path d="M8 21h8" />
    </>
  ),
  bible: (
    <>
      <path d="M4 4.6A1.6 1.6 0 0 1 5.6 3H19v15.6H5.6A1.6 1.6 0 0 0 4 20.2z" />
      <path d="M19 18.6v2.6H5.6" />
      <path d="M11.6 6.6v6.4M9.2 9h4.8" />
    </>
  ),
  songs: (
    <>
      <path d="M9 18V5.8l10-2v12" />
      <circle cx="6.6" cy="18" r="2.6" />
      <circle cx="16.6" cy="15.8" r="2.6" />
    </>
  ),
  more: (
    <>
      <path d="M4 7h16M4 12h16M4 17h10" />
    </>
  ),
  chevron: <path d="M9 5.5 15.5 12 9 18.5" />,
  back: <path d="M15 5.5 8.5 12 15 18.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20.5 20.5 16.2 16.2" />
    </>
  ),
  give: <path d="M12 20.4S3.8 14.2 3.8 9.1A4.6 4.6 0 0 1 12 6.3a4.6 4.6 0 0 1 8.2 2.8c0 5.1-8.2 11.3-8.2 11.3z" />,
  pin: (
    <>
      <path d="M12 21.2s7-6.4 7-11.2a7 7 0 1 0-14 0c0 4.8 7 11.2 7 11.2z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.4" y="5" width="17.2" height="16" rx="2.6" />
      <path d="M3.4 10h17.2M8.4 3v4M15.6 3v4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.2 9.6h17.6M3.2 14.4h17.6" />
      <path d="M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3z" />
    </>
  ),
  people: (
    <>
      <circle cx="9.2" cy="8.4" r="3.4" />
      <path d="M2.8 20c0-3.5 2.9-6 6.4-6s6.4 2.5 6.4 6" />
      <path d="M16.4 5.5a3.4 3.4 0 0 1 0 6.6M17.6 14.4c2.2.6 3.8 2.5 3.8 5" />
    </>
  ),
  text: (
    <>
      <path d="M3 19 8.2 6h1.4L15 19" />
      <path d="M5.4 14.6h7" />
      <path d="M16.4 19 19.6 11h.9L23 19" />
      <path d="M17.8 16.4h4" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M19.4 4.6 11 13" />
      <path d="M18 14.4V19a1.6 1.6 0 0 1-1.6 1.6H5A1.6 1.6 0 0 1 3.4 19V7.6A1.6 1.6 0 0 1 5 6h4.6" />
    </>
  ),
  check: <path d="M4.8 12.5 9.8 17.5 19.2 6.8" />,
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  remote: (
    <>
      <rect x="6.4" y="2.4" width="11.2" height="19.2" rx="3" />
      <path d="M12 6.4v4.4" />
      <circle cx="12" cy="17" r="1.4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.4M12 7.8v.2" />
    </>
  ),
  sparkle: <path d="M12 3l2.1 5.6L20 10.5l-5.9 1.9L12 18l-2.1-5.6L4 10.5l5.9-1.9z" />,
  // A collection box with a slot, a coin, and a hand reaching over to post it.
  // The hand is what says "giving"; the slot is what says this is the offering
  // box and not a drawer, so the hand is placed to the right of it rather than
  // across it.
  offering: (
    <>
      <path d="M2.9 14.2h18.2v5.6a1.8 1.8 0 0 1-1.8 1.8H4.7a1.8 1.8 0 0 1-1.8-1.8z" />
      <path d="M8.4 17.4h7.2" />
      <circle cx="7.2" cy="8.4" r="2.2" />
      <path d="M12.2 12.1V7.4a1.5 1.5 0 0 1 3 0v3.1M15.2 9.6a1.4 1.4 0 0 1 2.8 0v1.4M18 10.4a1.35 1.35 0 0 1 2.7 0v1.7c0 1.9-1.5 3.2-3.4 3.2h-1.9" />
    </>
  ),
  // The cup and the bread. The line across the bowl is the wine: without it the
  // glass reads as an empty goblet, or a trophy.
  communion: (
    <>
      <path d="M3.6 3.4h6.8v3.4a3.4 3.4 0 0 1-6.8 0z" />
      <path d="M3.9 5.6h6.2" />
      <path d="M7 10.2v7.4M4.5 18.2h5" />
      <path d="M12.6 18.2v-3a4.9 3.9 0 0 1 9.8 0v3z" />
      <path d="M15.4 13.6l1-1.5M18.6 13.4l1-1.5" />
    </>
  ),
  // Six teeth rather than the usual eight or twelve: at the ~17px this renders
  // at, finer teeth close up into a solid ring.
  gear: (
    <>
      <path d="M13.95 3.1h-3.9l-.42 2.05a6.9 6.9 0 0 0-1.62.94L6.05 5.4 4.1 8.78l1.55 1.4a7 7 0 0 0 0 1.87l-1.55 1.4 1.95 3.38 1.96-.69c.5.4 1.04.71 1.62.94l.42 2.05h3.9l.42-2.05a6.9 6.9 0 0 0 1.62-.94l1.96.69 1.95-3.38-1.55-1.4a7 7 0 0 0 0-1.87l1.55-1.4-1.95-3.38-1.96.69a6.9 6.9 0 0 0-1.62-.94z" />
      <circle cx="12" cy="12" r="2.9" />
    </>
  ),
  grip: <path d="M6 9.5h12M6 14.5h12" />
}
