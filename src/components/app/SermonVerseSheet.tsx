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
const LANGS: { id: VerseLang; label: string }[] = [
  { id: 'both', label: 'Both' },
  { id: 'telugu', label: 'తెలుగు' },
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
  const books = typingBook && ready ? suggestBooks(query, order).slice(0, 6) : []

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
      <div className="px-[var(--gutter)] pb-1">
        <div className="mb-3">
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
          <button className="btn-app btn-app-primary btn-block mt-3" type="submit" disabled={!ready || !query.trim()}>
            {ready ? 'Put it on screen' : 'Loading the bible…'}
          </button>
        </form>

        {books.length > 0 && (
          <div className="book-suggest mt-2" role="listbox">
            {books.map((b) => (
              <button
                key={b}
                type="button"
                role="option"
                aria-selected={false}
                className="book-suggest-item"
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
                <span className="book-suggest-name">{teBook(b)}</span>
                {teBook(b) !== b && <span className="book-suggest-key">{b}</span>}
              </button>
            ))}
          </div>
        )}

        {error ? (
          <p className="mt-2 text-[13px] leading-relaxed text-amber-700">{error}</p>
        ) : (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            It stays up until you move on — no timer. Back to sermon and Next section are on the operator screen.
          </p>
        )}

      </div>
    </Sheet>
  )
}
