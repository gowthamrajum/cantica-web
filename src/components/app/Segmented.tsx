/**
 * iOS-style segmented control. The selection is a single sliding thumb rather
 * than a restyle of each option, so switching animates smoothly on the
 * compositor. Options are equal-width (`flex: 1`), which is what lets the thumb
 * position be a plain `translateX(index * 100%)` of its own width.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
  ariaLabel
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
  className?: string
  ariaLabel?: string
}): JSX.Element {
  const index = Math.max(0, options.findIndex((o) => o.id === value))

  return (
    <div className={`segmented no-select ${className}`} role="tablist" aria-label={ariaLabel}>
      <span
        className="segmented-thumb"
        style={{
          width: `calc((100% - 6px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`
        }}
        aria-hidden="true"
      />
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === value}
          onClick={() => onChange(o.id)}
          className={`segmented-opt${o.id === value ? ' is-active' : ''}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
