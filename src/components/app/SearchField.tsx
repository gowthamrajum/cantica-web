import { useRef } from 'react'
import { Icon } from './Icons'

/**
 * A search input with a clear button.
 *
 * The clear button is fussier than it looks, because it sits directly above a
 * results list and every easy implementation lets a tap fall through onto the
 * first row:
 *
 *  - It keeps a full-height 36px hit target instead of being a bare 16px glyph
 *    at the edge of the field, so a slightly low tap still hits the button.
 *  - It stays mounted when the field is empty (hidden, not removed) so it can
 *    never unmount between pointerdown and click and hand the tap to whatever
 *    is underneath.
 *  - It clears on pointerdown with preventDefault, which keeps focus in the
 *    input. Letting the input blur closes the on-screen keyboard, the list
 *    reflows upward mid-tap, and the resulting click lands on a row that
 *    wasn't there when the finger went down.
 *
 * It is a div, not a label: wrapping the button in a label invites the browser
 * to forward activation to the input as well.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className = ''
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  ariaLabel: string
  className?: string
}): JSX.Element {
  const ref = useRef<HTMLInputElement>(null)

  const clear = (e: { preventDefault: () => void; stopPropagation: () => void }): void => {
    e.preventDefault()
    e.stopPropagation()
    onChange('')
    ref.current?.focus()
  }

  return (
    <div className={`search-field ${className}`}>
      <Icon name="search" size={18} className="flex-none" />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        enterKeyHint="search"
        type="search"
      />
      <button
        type="button"
        className={`sf-clear${value ? '' : ' is-hidden'}`}
        aria-label="Clear search"
        aria-hidden={!value}
        tabIndex={value ? 0 : -1}
        onPointerDown={clear}
        // A stray click after pointerdown must not reach anything else.
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  )
}
