import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Screen } from '../components/app/Screen'
import { useScreenScroll } from '../components/app/screenScroll'
import { Sheet } from '../components/app/Sheet'
import { Segmented } from '../components/app/Segmented'
import { Icon } from '../components/app/Icons'
import { SearchField } from '../components/app/SearchField'
import { loadBible, teBook, type IndexedBible, type Lang } from '../lib/bible'
import { READ_SIZES, useBiblePlace, usePref, useReadSize, useSwipe } from '../lib/prefs'

const LANGS: { id: Lang; label: string }[] = [
  { id: 'te', label: 'తెలుగు' },
  { id: 'en', label: 'English' },
  { id: 'both', label: 'Both' }
]

type Picker = 'none' | 'book' | 'chapter' | 'settings'

export function Bible(): JSX.Element {
  const [place, setPlace] = useBiblePlace()
  const { book, chapter } = place
  const [lang, setLang] = usePref<Lang>('tcc-bible-lang', 'both')
  const read = useReadSize()

  const [picker, setPicker] = useState<Picker>('none')
  const [pickerBook, setPickerBook] = useState(book)
  const [query, setQuery] = useState('')
  const [en, setEn] = useState<IndexedBible | null>(null)
  const [te, setTe] = useState<IndexedBible | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    loadBible('web')
      .then(setEn)
      .catch(() => setError(true))
  }, [])
  useEffect(() => {
    if (lang !== 'en' && !te) loadBible('telugu').then(setTe).catch(() => undefined)
  }, [lang, te])

  const meta = en ?? te
  const order = useMemo(() => meta?.order ?? [], [meta])
  const chapterCount = meta?.chapters[book] ?? 1
  const needEn = lang !== 'te'
  const needTe = lang !== 'en'
  const ready = (!needEn || en) && (!needTe || te)

  const enV = en?.byBook[book]?.[chapter] ?? []
  const teV = te?.byBook[book]?.[chapter] ?? []
  const count = Math.max(enV.length, teV.length)

  const scrollEl = useScreenScroll()

  const goto = useCallback(
    (b: string, c: number) => {
      setPlace({ book: b, chapter: c })
      // A new chapter always starts at the top, like turning a page.
      scrollEl?.scrollTo({ top: 0, behavior: 'auto' })
    },
    [setPlace, scrollEl]
  )

  // A stored place can outlive the data it pointed at (corrupt storage, a book
  // renamed in a future data drop) — fall back rather than render an empty page.
  useEffect(() => {
    if (order.length > 0 && !order.includes(book)) setPlace({ book: 'Genesis', chapter: 1 })
  }, [order, book, setPlace])

  // Walk continuously across book boundaries, so Next at the end of Malachi
  // opens Matthew 1 rather than dead-ending.
  const step = useCallback(
    (dir: 1 | -1) => {
      const max = meta?.chapters[book] ?? 1
      const nextC = chapter + dir
      if (nextC >= 1 && nextC <= max) return goto(book, nextC)
      const i = order.indexOf(book)
      const j = i + dir
      if (j < 0 || j >= order.length) return
      const nb = order[j]
      goto(nb, dir === 1 ? 1 : (meta?.chapters[nb] ?? 1))
    },
    [book, chapter, goto, meta, order]
  )

  // Swipe sideways to turn the chapter (phones only — it's a touch gesture).
  const onSwipe = useCallback((dir: 'left' | 'right') => step(dir === 'left' ? 1 : -1), [step])
  useSwipe(scrollEl, onSwipe, !!ready)

  const atFirst = order.indexOf(book) === 0 && chapter === 1
  const atLast = order.indexOf(book) === order.length - 1 && chapter === chapterCount

  const mainName = lang === 'te' ? teBook(book) : book
  const subName = lang === 'te' ? book : lang === 'en' ? null : teBook(book)

  const openBooks = (): void => {
    setQuery('')
    setPicker('book')
  }

  return (
    <Screen
      title={`${book} ${chapter}`}
      onTitleTap={openBooks}
      trailing={
        <>
          <button type="button" className="icon-btn" onClick={openBooks} aria-label="Choose a book">
            <Icon name="bible" size={21} />
          </button>
          <button type="button" className="icon-btn" onClick={() => setPicker('settings')} aria-label="Reading settings">
            <Icon name="text" size={21} />
          </button>
        </>
      }
      hero={
        <div className="screen-hero">
          <span className="screen-eyebrow">Holy Bible · పరిశుద్ధ గ్రంథము</span>
          <button type="button" onClick={openBooks} className="mt-1 flex items-center gap-2 text-left pressable">
            <span className="screen-title">
              {mainName} {chapter}
            </span>
            <Icon name="chevron" size={19} strokeWidth={2.4} className="mt-1.5 flex-none rotate-90 text-ink-muted" />
          </button>
          {subName && (
            <p className="mt-1 font-serif text-[17px] italic text-gold-600">
              {subName} {chapter}
            </p>
          )}
        </div>
      }
    >
      {error && <Centered>Couldn’t load the Bible.</Centered>}
      {!ready && !error && (
        <Centered>
          <span className="spinner" /> Loading the Word…
        </Centered>
      )}

      {ready && (
        <>
          <div
            className="mt-3 space-y-3.5 px-[var(--gutter)]"
            style={{ '--read-size': `${read.size}px` } as CSSProperties}
          >
            {Array.from({ length: count }).map((_, i) => {
              const n = i + 1
              const t = teV[i]?.text
              const e = enV[i]?.text
              return (
                <p key={n} className="verse-body">
                  <span className="mr-1.5 align-super font-serif text-[12px] font-bold text-gold-500">{n}</span>
                  {needTe && t && <span className="verse-te text-ink">{t} </span>}
                  {needEn && e && (
                    <span className={`verse-en ${lang === 'both' ? 'text-ink-soft' : 'text-ink'}`}>{e}</span>
                  )}
                </p>
              )
            })}
          </div>

          {/* Chapter nav mirrors the swipe gesture for anyone on a desktop. */}
          <div className="mt-8 flex items-center gap-2.5 px-[var(--gutter)]">
            <button
              type="button"
              disabled={atFirst}
              onClick={() => step(-1)}
              className="btn-app btn-app-quiet flex-1 text-[15px]"
            >
              <Icon name="back" size={17} strokeWidth={2.4} /> Previous
            </button>
            <button
              type="button"
              disabled={atLast}
              onClick={() => step(1)}
              className="btn-app btn-app-quiet flex-1 text-[15px]"
            >
              Next <Icon name="chevron" size={17} strokeWidth={2.4} />
            </button>
          </div>
          <p className="px-[var(--gutter)] pt-4 text-center text-[13px] text-ink-muted">
            Chapter {chapter} of {chapterCount}
            {te || en ? ' · ' : ''}
            {[te ? 'Telugu OV' : '', en ? en.name : ''].filter(Boolean).join(' · ')}
          </p>
        </>
      )}

      {/* -------------------------------------------------------- book picker */}
      <Sheet open={picker === 'book'} title="Choose a book" onClose={() => setPicker('none')}>
        <div className="px-[var(--gutter)] pb-3">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search books…"
            ariaLabel="Search books"
          />
        </div>
        <BookList
          order={order}
          current={book}
          query={query}
          onPick={(b) => {
            setPickerBook(b)
            setPicker('chapter')
          }}
        />
      </Sheet>

      {/* ----------------------------------------------------- chapter picker */}
      <Sheet
        open={picker === 'chapter'}
        title={`${pickerBook} · ${teBook(pickerBook)}`}
        onClose={() => setPicker('none')}
      >
        <div className="grid grid-cols-5 gap-2 px-[var(--gutter)] sm:grid-cols-7">
          {Array.from({ length: meta?.chapters[pickerBook] ?? 1 }).map((_, i) => {
            const c = i + 1
            const active = pickerBook === book && c === chapter
            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  goto(pickerBook, c)
                  setPicker('none')
                }}
                className={`pressable rounded-xl border py-3 font-serif text-[16px] font-semibold transition ${
                  active ? 'border-gold-400 bg-gold-50 text-gold-700' : 'border-line bg-card text-ink'
                }`}
              >
                {c}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => setPicker('book')}
          className="mt-4 flex w-full items-center justify-center gap-1.5 py-2 text-[14.5px] font-semibold text-ink-muted"
        >
          <Icon name="back" size={15} strokeWidth={2.4} /> All books
        </button>
      </Sheet>

      {/* --------------------------------------------------- reading settings */}
      <Sheet open={picker === 'settings'} title="Reading" onClose={() => setPicker('none')}>
        <div className="px-[var(--gutter)]">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.13em] text-ink-muted">Language</p>
          <Segmented options={LANGS} value={lang} onChange={setLang} ariaLabel="Bible language" />

          <p className="mb-2 mt-6 text-[12px] font-bold uppercase tracking-[0.13em] text-ink-muted">Text size</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={read.dec}
              disabled={!read.canDec}
              className="btn-app btn-app-quiet h-11 w-14 flex-none disabled:opacity-40"
              aria-label="Smaller text"
            >
              <Icon name="minus" size={18} strokeWidth={2.4} />
            </button>
            <div className="flex flex-1 items-center justify-center gap-1">
              {READ_SIZES.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${i <= read.step ? 'bg-gold-500' : 'bg-line'}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={read.inc}
              disabled={!read.canInc}
              className="btn-app btn-app-quiet h-11 w-14 flex-none disabled:opacity-40"
              aria-label="Larger text"
            >
              <Icon name="plus" size={18} strokeWidth={2.4} />
            </button>
          </div>
          <p
            className="mt-4 rounded-xl border border-line bg-card p-4 text-ink"
            style={{ fontSize: `${read.size}px`, lineHeight: 1.7 }}
          >
            <span className="mr-1.5 align-super font-serif text-[12px] font-bold text-gold-500">1</span>
            ఆదియందు దేవుడు భూమ్యాకాశములను సృజించెను.
          </p>
          <p className="pb-2 pt-3 text-[13px] leading-relaxed text-ink-muted">
            Swipe left or right anywhere on the page to turn the chapter. Your place, language and text size are
            remembered.
          </p>
        </div>
      </Sheet>
    </Screen>
  )
}

function Centered({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-center gap-2.5 py-20 text-[15px] text-ink-muted">{children}</div>
  )
}

/** Books grouped by testament, filtered by an English- or Telugu-name search. */
function BookList({
  order,
  current,
  query,
  onPick
}: {
  order: string[]
  current: string
  query: string
  onPick: (b: string) => void
}): JSX.Element {
  const q = query.trim().toLowerCase()
  const nt = order.indexOf('Matthew')
  const groups = useMemo(() => {
    const match = (b: string): boolean => !q || b.toLowerCase().includes(q) || teBook(b).includes(query.trim())
    if (q) return [{ label: 'Results', books: order.filter(match) }]
    return [
      { label: 'Old Testament', books: nt > 0 ? order.slice(0, nt) : order },
      { label: 'New Testament', books: nt > 0 ? order.slice(nt) : [] }
    ].filter((g) => g.books.length > 0)
  }, [order, q, query, nt])

  if (groups.every((g) => g.books.length === 0)) {
    return <p className="py-12 text-center text-[15px] text-ink-muted">No book matches “{query}”.</p>
  }

  return (
    <>
      {groups.map((g) => (
        <div key={g.label}>
          <div className="index-head">{g.label}</div>
          <div className="grid grid-cols-2 gap-2 px-[var(--gutter)] py-3 sm:grid-cols-3">
            {g.books.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => onPick(b)}
                className={`pressable flex flex-col rounded-xl border px-3.5 py-2.5 text-left ${
                  b === current ? 'border-gold-400 bg-gold-50' : 'border-line bg-card'
                }`}
              >
                <span className="truncate font-serif text-[15px] font-semibold text-ink">{b}</span>
                <span className="truncate text-[12.5px] text-gold-600">{teBook(b)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
