import { useEffect, useRef } from 'react'
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
 *  - …and it prevents the touch and mouse defaults too, because pointerdown
 *    alone does not hold focus everywhere. See keepFocus below.
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
  const btn = useRef<HTMLButtonElement>(null)

  const clear = (e: { preventDefault: () => void; stopPropagation: () => void }): void => {
    e.preventDefault()
    e.stopPropagation()
    onChange('')
    ref.current?.focus()
  }

  /**
   * Keep the on-screen keyboard up while the field is cleared.
   *
   * Preventing pointerdown is supposed to suppress the compatibility mouse
   * events, and with them the focus moving to the button — but iOS does not
   * honour it, so the input blurs and the keyboard drops. Worse, the blur
   * arrives on the LATER mouse event, so refocusing from the pointerdown
   * handler happens too early to help and the field is left dead: cleared, but
   * needing another tap before anything can be typed.
   *
   * Preventing touchstart is what actually stops that sequence on iOS, and it
   * has to be a native non-passive listener because React registers touchstart
   * passively, where preventDefault does nothing at all.
   */
  useEffect(() => {
    const el = btn.current
    if (!el) return
    const keepFocus = (e: TouchEvent): void => {
      e.preventDefault()
      onChange('')
      ref.current?.focus()
    }
    el.addEventListener('touchstart', keepFocus, { passive: false })
    return () => el.removeEventListener('touchstart', keepFocus)
  }, [onChange])

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
        ref={btn}
        type="button"
        className={`sf-clear${value ? '' : ' is-hidden'}`}
        aria-label="Clear search"
        aria-hidden={!value}
        tabIndex={value ? 0 : -1}
        onPointerDown={clear}
        // With a mouse it is this, not pointerdown, that decides whether focus
        // leaves the input — and a focused input is a keyboard still open.
        onMouseDown={(e) => e.preventDefault()}
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
