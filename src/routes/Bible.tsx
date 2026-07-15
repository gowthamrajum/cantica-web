import { useEffect, useState, type ReactNode } from 'react'
import { PageBar } from '../components/PageBar'
import { Footer } from '../components/Footer'
import { loadBible, teBook, type IndexedBible, type Lang } from '../lib/bible'

const LANGS: { id: Lang; label: string }[] = [
  { id: 'te', label: 'తెలుగు' },
  { id: 'en', label: 'English' },
  { id: 'both', label: 'Both' }
]

export function Bible(): JSX.Element {
  const [lang, setLang] = useState<Lang>('both')
  const [book, setBook] = useState('Genesis')
  const [chapter, setChapter] = useState(1)
  const [picker, setPicker] = useState<'none' | 'book' | 'chapter'>('none')
  const [en, setEn] = useState<IndexedBible | null>(null)
  const [te, setTe] = useState<IndexedBible | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    loadBible('web').then(setEn).catch(() => setError(true))
  }, [])
  useEffect(() => {
    if (lang !== 'en' && !te) loadBible('telugu').then(setTe).catch(() => undefined)
  }, [lang, te])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [book, chapter])

  const meta = en ?? te
  const order = meta?.order ?? []
  const chapterCount = meta?.chapters[book] ?? 1
  const needEn = lang !== 'te'
  const needTe = lang !== 'en'
  const ready = (!needEn || en) && (!needTe || te)

  const enV = en?.byBook[book]?.[chapter] ?? []
  const teV = te?.byBook[book]?.[chapter] ?? []
  const count = Math.max(enV.length, teV.length)

  const mainName = lang === 'te' ? teBook(book) : book
  const subName = lang === 'te' ? book : lang === 'en' ? null : teBook(book)

  return (
    <div className="flex min-h-svh flex-col">
      <PageBar />
      <main className="container-x flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <p className="eyebrow">Holy Bible · పరిశుద్ధ గ్రంథము</p>

          {/* controls */}
          <div className="sticky top-[68px] z-20 -mx-2 mb-8 mt-4 flex flex-wrap items-center gap-3 bg-paper/95 px-2 py-2 backdrop-blur">
            <button
              onClick={() => setPicker('book')}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 font-serif text-lg font-semibold text-ink shadow-soft transition hover:border-gold-400"
            >
              {book} {chapter}
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <div className="ml-auto flex gap-1 rounded-full border border-line bg-card p-1 shadow-soft">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLang(l.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${lang === l.id ? 'bg-navy-700 text-paper' : 'text-ink-soft hover:text-gold-600'}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="py-20 text-center text-ink-muted">Couldn’t load the Bible.</p>}
          {!ready && !error && <p className="py-20 text-center text-ink-muted">Loading the Word…</p>}

          {ready && (
            <>
              <header className="mb-8 border-b border-line pb-6">
                <h1 className="font-serif text-4xl font-semibold text-ink sm:text-5xl">{mainName} {chapter}</h1>
                {subName && <p className="mt-1 font-serif text-xl italic text-gold-600">{subName} {chapter}</p>}
              </header>

              <div className="space-y-4">
                {Array.from({ length: count }).map((_, i) => {
                  const n = i + 1
                  const t = teV[i]?.text
                  const e = enV[i]?.text
                  return (
                    <p key={n} className="leading-relaxed">
                      <span className="mr-2 align-super font-serif text-[13px] font-bold text-gold-500">{n}</span>
                      {needTe && t && <span className="text-[19px] text-ink">{t} </span>}
                      {needEn && e && <span className={`text-[17px] ${lang === 'both' ? 'text-ink-soft' : 'text-ink'}`}>{e}</span>}
                    </p>
                  )
                })}
              </div>

              <div className="mt-12 flex items-center justify-between border-t border-line pt-6">
                <ChapBtn disabled={chapter <= 1} onClick={() => setChapter((c) => Math.max(1, c - 1))}>‹ Previous</ChapBtn>
                <span className="text-sm text-ink-muted">Chapter {chapter} of {chapterCount}</span>
                <ChapBtn disabled={chapter >= chapterCount} onClick={() => setChapter((c) => Math.min(chapterCount, c + 1))}>Next ›</ChapBtn>
              </div>
              <p className="mt-8 text-center text-[13px] text-ink-muted">
                {te ? 'Telugu OV' : ''}{te && en ? ' · ' : ''}{en ? en.name : ''}
              </p>
            </>
          )}
        </div>
      </main>
      <Footer />

      {picker === 'book' && (
        <PickerOverlay title="Choose a book · పుస్తకము" onClose={() => setPicker('none')}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {order.map((b) => (
              <button
                key={b}
                onClick={() => {
                  setBook(b)
                  setChapter(1)
                  setPicker('chapter')
                }}
                className={`flex flex-col rounded-xl border px-3.5 py-2.5 text-left transition ${
                  b === book ? 'border-gold-400 bg-gold-50' : 'border-line bg-card hover:border-gold-300'
                }`}
              >
                <span className="truncate font-serif text-[15px] font-semibold text-ink">{b}</span>
                <span className="truncate text-xs text-gold-600">{teBook(b)}</span>
              </button>
            ))}
          </div>
        </PickerOverlay>
      )}
      {picker === 'chapter' && (
        <PickerOverlay title={`${book} · ${teBook(book)}`} onClose={() => setPicker('none')}>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
            {Array.from({ length: meta?.chapters[book] ?? 1 }).map((_, i) => {
              const c = i + 1
              return (
                <button
                  key={c}
                  onClick={() => {
                    setChapter(c)
                    setPicker('none')
                  }}
                  className={`rounded-lg border py-2.5 font-serif text-[15px] font-semibold transition ${
                    c === chapter ? 'border-gold-400 bg-gold-50 text-gold-700' : 'border-line bg-card text-ink hover:border-gold-300'
                  }`}
                >
                  {c}
                </button>
              )
            })}
          </div>
        </PickerOverlay>
      )}
    </div>
  )
}

function ChapBtn({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }): JSX.Element {
  return (
    <button disabled={disabled} onClick={onClick} className="rounded-full border border-line bg-card px-5 py-2 font-semibold text-navy-700 shadow-soft transition hover:border-gold-400 disabled:opacity-40 disabled:hover:border-line">
      {children}
    </button>
  )
}

function PickerOverlay({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-paper">
      <div className="container-x py-6">
        <div className="mb-6 flex items-center gap-3">
          <button onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full border border-line bg-card text-ink-soft transition hover:border-gold-400">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <h2 className="font-serif text-2xl font-semibold text-ink">{title}</h2>
        </div>
        <div className="mx-auto max-w-3xl">{children}</div>
      </div>
    </div>
  )
}
