import { useEffect, useRef, useState } from 'react'
import { Sheet } from './Sheet'
import { Segmented } from './Segmented'
import { loadBible, type IndexedBible } from '../../lib/bible'
import { parseReference, versesFor, type VerseLang } from '../../lib/reference'
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
  /** What this sitting has put on the screen, newest first. */
  const [sent, setSent] = useState<string[]>([])
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
    setSent((s) => [passage.label, ...s].slice(0, 8))
    setQuery('')
    input.current?.focus()
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

        {error ? (
          <p className="mt-2 text-[13px] leading-relaxed text-amber-700">{error}</p>
        ) : (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            It stays up until you move on — no timer. Next and Previous work as usual.
          </p>
        )}

        {sent.length > 0 && (
          <>
            <p className="mt-4 mb-1 list-label">On screen this sermon</p>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {sent.map((s, i) => (
                <span
                  key={`${s}-${i}`}
                  className={`pill ${i === 0 ? 'bg-gold-500/20 text-gold-700' : 'bg-line/60 text-ink-muted'}`}
                >
                  {s}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}
