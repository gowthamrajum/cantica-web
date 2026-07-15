/** A classic church mark: a lancet-arch window with a cross, drawn in currentColor. */
export function Emblem({ className }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 40 44" className={className} fill="none" aria-hidden="true">
      <path
        d="M8 41V16.5C8 9.4 13.4 4 20 4s12 5.4 12 12.5V41"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M6.5 41h27" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 14v18M13.5 21h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** The emblem inside a filled roundel — used as the site logo. */
export function EmblemBadge({ className = 'h-11 w-11', tone = 'navy' }: { className?: string; tone?: 'navy' | 'gold' | 'paper' }): JSX.Element {
  const bg = tone === 'gold' ? 'bg-gold-500 text-white' : tone === 'paper' ? 'bg-paper text-navy-700' : 'bg-navy-700 text-gold-300'
  return (
    <span className={`grid place-items-center rounded-full ring-1 ring-inset ring-white/15 ${bg} ${className}`}>
      <Emblem className="h-[58%] w-[58%]" />
    </span>
  )
}
