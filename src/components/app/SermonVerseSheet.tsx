import { useEffect, useRef, useState } from 'react'
import { Sheet } from './Sheet'
import { Segmented } from './Segmented'
import { loadBible, teBook, type IndexedBible } from '../../lib/bible'
import { parseReference, suggestBooks, versesFor, type VerseLang } from '../../lib/reference'
import type { VersePayload } from '../../lib/relay'

/**
 * Verses during the sermon, at the speed they get quoted.
 *
 * A preacher names a reference and the next one a minute later. Anything that
 * takes more than typing it and pressing Go is too slow to keep up, so this is
 * one field: type, send, it is on the screen, the box clears and keeps the
 * focus for the next one.
 *
 * Both bibles are already in this app, so the phone resolves the reference
 * itself and sends finished lines. The relay carries them without knowing what
 * they are, and the presenter — desktop or web — needs no bible of its own.
 *
 * There is deliberately no timer. On the desktop a verse can time out back to
 * the sermon card; here it stays until the operator moves on, because the
 * person who knows how long a verse is wanted is the one preaching, and a
 * countdown takes it away mid-sentence.
 */
const LANGS: { id: VerseLang; label: string; lang?: string }[] = [
  { id: 'both', label: 'Both' },
  { id: 'telugu', label: 'తెలుగు', lang: 'te' },
  { id: 'english', label: 'English' }
]

export function SermonVerseSheet({
  open,
  onClose,
  onSend
}: {
  open: boolean
  onClose: () => void
  onSend: (payload: VersePayload) => void | Promise<void>
}): JSX.Element {
  const [te, setTe] = useState<IndexedBible | null>(null)
  const [en, setEn] = useState<IndexedBible | null>(null)
  const [lang, setLang] = useState<VerseLang>('both')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    void Promise.all([loadBible('telugu'), loadBible('web')]).then(([t, e]) => {
      setTe(t)
      setEn(e)
    })
    setTimeout(() => input.current?.focus(), 50)
  }, [open])

  const order = te?.order ?? en?.order ?? []
  const ready = !!(te || en)

  /**
   * Books worth offering for what has been typed.
   *
   * Only while the BOOK is still being typed — once a chapter number is there
   * the book is settled, and a dangling list under the field just swallows the
   * next tap. "Yohanu" reaches John through the Telugu name romanised, which is
   * what anybody without a Telugu keyboard types.
   */
  const typingBook = /^[^0-9]*$/.test(query.trim())
  const books = typingBook && ready ? suggestBooks(query, order).slice(0, 8) : []

  /**
   * What is about to go on the screen, worked out as it is typed.
   *
   * The same parse the send does, so this cannot promise one thing and put up
   * another. Worth the work on every keystroke because the alternative is
   * finding out by looking at the wall — and by then the congregation has seen
   * it too. Silent while the reference is half-typed; there is nothing useful
   * to say about "Joh".
   */
  const preview =
    ready && !typingBook && query.trim()
      ? (() => {
          const ref = parseReference(query, order)
          if (!ref) return null
          const passage = versesFor(ref, te, en, lang)
          if (!passage) return null
          // A slide per verse is how the passage is built, so the slide count
          // IS the verse count — no second source to fall out of step with it.
          return { label: passage.label, n: passage.slides?.length ?? 1 }
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
      setError('That reference isn’t in the bible — check the chapter and verse.')
      return
    }
    setError('')
    await onSend(passage)
    setQuery('')
    // Out of the way: the verse is on the screen and the operator wants to see
    // it, not the box that sent it. Back to sermon and Next section live on the
    // operator screen behind this, which is where they are needed next.
    onClose()
  }

  return (
    <Sheet open={open} title="Verse on screen" onClose={onClose}>
      <div className="verse-sheet px-[var(--gutter)] pb-1">
        <div className="verse-langs">
          <Segmented options={LANGS} value={lang} onChange={setLang} ariaLabel="Verse language" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void go()
          }}
        >
          <input
            ref={input}
            className="search-field w-full text-center text-[17px]"
            type="text"
            inputMode="text"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="John 3:16"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setError('')
            }}
            disabled={!ready}
          />
          {/* Reserves its line whether or not it has anything to say, so the
              button never jumps out from under a thumb that is already moving
              towards it. */}
          <p className={`verse-preview${preview ? ' is-on' : ''}`} aria-live="polite">
            {preview ? (
              <>
                <span className="verse-preview-ref">{preview.label}</span>
                <span className="verse-preview-n">
                  {preview.n} verse{preview.n === 1 ? '' : 's'}
                </span>
              </>
            ) : (
              '\u00a0'
            )}
          </p>
          <button className="btn-app btn-app-primary btn-block" type="submit" disabled={!ready || !query.trim()}>
            {ready ? 'Put it on screen' : 'Loading the bible…'}
          </button>
        </form>

        {books.length > 0 && (
          <div className="book-chips" role="listbox">
            {books.map((b) => (
              <button
                key={b}
                type="button"
                role="option"
                aria-selected={false}
                className="book-chip"
                // The Telugu name goes in the box, not the English key: it is
                // what was asked for and what the reader is thinking in, and the
                // parser matches it exactly. A trailing space because a chapter
                // always follows and this is tapped by someone in a hurry.
                onClick={() => {
                  setQuery(`${teBook(b)} `)
                  setError('')
                  input.current?.focus()
                }}
              >
                <span className="book-chip-name">{teBook(b)}</span>
                {teBook(b) !== b && <span className="book-chip-key">{b}</span>}
              </button>
            ))}
          </div>
        )}

        {error ? (
          <p className="verse-note is-error">{error}</p>
        ) : (
          <p className="verse-note">
            It stays up until you move on — no timer. Back to sermon and Next section are on the operator screen.
          </p>
        )}

      </div>
    </Sheet>
  )
}
