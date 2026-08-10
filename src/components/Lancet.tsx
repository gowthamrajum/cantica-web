/**
 * Faint stained-glass lancet motif. Sits behind the dark hero on both versions
 * of the home page — the one piece of ornament the design allows itself, so it
 * has to be the same shape in both.
 */
export function Lancet({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 200 380" className={className} fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2">
        <path d="M20 380V95C20 45 55 8 100 8s80 37 80 87v285" />
        <path d="M100 8v372" />
        <path d="M20 150h160M20 235h160M20 320h160" />
        <path d="M60 26v354M140 26v354" opacity=".6" />
        <circle cx="100" cy="70" r="26" opacity=".7" />
        <path d="M100 44v52M74 70h52" opacity=".5" />
      </g>
    </svg>
  )
}
