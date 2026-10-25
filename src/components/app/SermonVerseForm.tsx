import { useEffect, useRef, useState } from 'react'
import { teBook, type IndexedBible } from '../../lib/bible'
import { explainReference, parseReference, suggestBooks, versesFor, type Reference, type VerseLang } from '../../lib/reference'
import type { VersePayload } from '../../lib/relay'

/**
 * Verses during the sermon, at the speed they get quoted.
 *
 * Always on the sermon phone's screen, never behind a button: a preacher names
 * a reference and the next one a minute later, and opening a sheet first was
 * one tap too many each time. Type, send, it is on the screen.
 *
 * Both bibles are already in this app, so the phone resolves the reference
 * itself and sends finished lines. The relay carries them without knowing what
 * they are, and the presenter — desktop or web — needs no bible of its own.
 *
 * There is deliberately no timer. On the desktop a verse can time out back to
 * the sermon card; here it stays until the operator moves on, because the
 * person who knows how long a verse is wanted is the one preaching.
 */
const LANGS: { id: VerseLang; label: string; lang?: string }[] = [
  { id: 'both', label: 'Both' },
  { id: 'telugu', label: 'తెలుగు', lang: 'te' },
  { id: 'english', label: 'English' }
]

export function SermonVerseForm({
  te,
  en,
  disabled,
  prefill,
  onSend
}: {
  /** The bibles, loaded by the screen that owns this form. */
  te: IndexedBible | null
  en: IndexedBible | null
  /** Off the sermon: the form stays visible but sends nothing. */
  disabled?: boolean
  /**
   * Text to start the field with — a book name and a space when the operator
   * tapped + on a book in the history. `n` changes on every tap, so tapping the
   * same book twice still puts it back.
   */
  prefill?: { text: string; n: number }
  /**
   * The finished passage, and the reference it came from. The reference
   * travels alongside because the screen offers the verse either side of what
   * went up, and working that out from the payload would mean parsing the
   * label back into numbers.
   */
  onSend: (payload: VersePayload, ref: Reference, lang: VerseLang) => void | Promise<void>
}): JSX.Element {
  const [lang, setLang] = useState<VerseLang>('both')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  /**
   * Whether the finger that is down has moved — i.e. is scrolling the book row,
   * not picking from it. A touch that drags still delivers a click to whatever
   * it started on, so flicking along the books put a book in the field.
   */
  const scrolled = useRef(false)
  const startX = useRef(0)

  useEffect(() => {
    if (!prefill) return
    setQuery(prefill.text)
    setError('')
    input.current?.focus()
  }, [prefill])

  const order = te?.order ?? en?.order ?? []
  const ready = !!(te || en) && !disabled

  /**
   * Books worth offering, only while the BOOK is still being typed — once a
   * chapter number is there the book is settled. "Yohanu" reaches John through
   * the Telugu name romanised, which is what anybody without a Telugu keyboard
   * types.
   */
  const typingBook = /^[^0-9]*$/.test(query.trim())
  const books = typingBook && ready && query.trim() ? suggestBooks(query, order).slice(0, 8) : []

  /**
   * What is about to go on the screen, worked out as it is typed — the same
   * parse the send does, so this cannot promise one thing and put up another.
   */
  const preview: { label?: string; n?: number; note?: string } | null =
    ready && !typingBook && query.trim()
      ? (() => {
          const ref = parseReference(query, order)
          if (!ref) return null
          const passage = versesFor(ref, te, en, lang)
          // Past the end of the book or chapter: say how far it goes, as it is
          // typed — before Put on screen, not after.
          const note = explainReference(ref, te, en) ?? undefined
          if (!passage) return note ? { note } : null
          return { label: passage.label, n: passage.slides?.length ?? 1, note }
        })()
      : null

  const go = async (): Promise<void> => {
    if (!ready) return
    const ref = parseReference(query, order)
    if (!ref) {
      // Two different failures, and telling them apart is what stops someone
      // retyping a reference that was right all along.
      setError(
        /\d/.test(query)
          ? 'Couldn’t place that book — try more of its name, like “John” or “1 Cor”.'
          : 'Type a reference, like John 3:16 or Rom 8:28-30.'
      )
      return
    }
    const passage = versesFor(ref, te, en, lang)
    if (!passage) {
      setError(explainReference(ref, te, en) ?? 'That reference isn’t in the bible — check the chapter and verse.')
      return
    }
    setError('')
    await onSend(passage, ref, lang)
    setQuery('')
    // Keyboard down: the verse is on the screen and the operator wants to see
    // it on the card below, not the keys that sent it.
    input.current?.blur()
  }

  return (
    <div className="vf">
      <form
        className="vf-row"
        onSubmit={(e) => {
          e.preventDefault()
          void go()
        }}
      >
        <input
          ref={input}
          className="vf-input"
          type="text"
          inputMode="text"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder={disabled ? 'Verses go up during the sermon' : 'John 3:16'}
          aria-label="Bible reference"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setError('')
          }}
          disabled={!ready}
        />
        <button className="vf-go" type="submit" disabled={!ready || !query.trim()}>
          {te || en ? 'Put on screen' : 'Loading…'}
        </button>
      </form>

      <div className="vf-meta">
        <div className="vf-langs" role="radiogroup" aria-label="Verse language">
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={lang === l.id}
              lang={l.lang}
              className={lang === l.id ? 'is-on' : ''}
              onClick={() => setLang(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
        {/* Holds its place whether or not it has anything to say, so nothing
            below moves while a reference is being typed. */}
        <p
          className={`vf-preview${error || (preview?.note && !preview.label) ? ' is-error' : preview ? ' is-on' : ''}`}
          aria-live="polite"
        >
          {error ||
            (preview ? (
              <>
                {preview.label && (
                  <>
                    <b>{preview.label}</b> · {preview.n} verse{preview.n === 1 ? '' : 's'}
                    {preview.note ? ' — ' : ''}
                  </>
                )}
                {preview.note && <span className="vf-note">{preview.note}</span>}
              </>
            ) : (
              ' '
            ))}
        </p>
      </div>

      {books.length > 0 && (
        <div
          className="vf-books"
          role="listbox"
          onPointerDown={(e) => {
            scrolled.current = false
            startX.current = e.clientX
          }}
          onPointerMove={(e) => {
            if (Math.abs(e.clientX - startX.current) > 8) scrolled.current = true
          }}
          onPointerCancel={() => {
            scrolled.current = true
          }}
          onScroll={() => {
            scrolled.current = true
          }}
        >
          {books.map((b) => (
            <button
              key={b}
              type="button"
              role="option"
              aria-selected={false}
              // The Telugu name goes in the box: it is what the reader is
              // thinking in, and the parser matches it exactly. A trailing
              // space, because a chapter always follows.
              onClick={() => {
                if (scrolled.current) return
                setQuery(`${teBook(b)} `)
                setError('')
                input.current?.focus()
              }}
            >
              <span lang="te">{teBook(b)}</span>
              {teBook(b) !== b && <small>{b}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
