import { useEffect, useRef, useState } from 'react'
import { Screen, Section } from '../components/app/Screen'
import { Icon } from '../components/app/Icons'
import { uploadMedia } from '../lib/mediaUpload'
import { cleanTag, suggestTags } from '../lib/bgTags'
import {
  addBackground,
  checkAdminPin,
  listBackgrounds,
  removeBackground,
  updateBackground,
  type LibraryBackground
} from '../lib/relay'

const PIN_KEY = 'tcc-admin-pin'
const readPin = (): string => {
  try {
    return sessionStorage.getItem(PIN_KEY) ?? ''
  } catch {
    return ''
  }
}

const mb = (n: number): string => `${Math.max(1, Math.round(n / 1048576))} MB`

/** A video's frame size, read in the browser before anything is uploaded. */
function videoSize(file: File): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    const url = URL.createObjectURL(file)
    const done = (r: { w: number; h: number } | null): void => {
      URL.revokeObjectURL(url)
      resolve(r)
    }
    v.preload = 'metadata'
    v.muted = true
    v.onloadedmetadata = () => done({ w: v.videoWidth, h: v.videoHeight })
    v.onerror = () => done(null)
    v.src = url
  })
}

/**
 * The Background Library — motion backgrounds every Cantica presenter can use.
 *
 * Admins add and remove them here, and only here: the presenters list the
 * library and use it, and cannot change it. The relay enforces that with the
 * admin PIN, so hiding the buttons in the desktop app isn't the only thing
 * standing between a volunteer and deleting Sunday's background.
 *
 * A video goes straight from this browser to the media store, then is
 * registered on the relay. Each presenter keeps its own copy to play from, so a
 * smaller file is better for every computer — hence the 1080p nudge below.
 */
export function BackgroundLibrary(): JSX.Element {
  const [pin, setPin] = useState(readPin)
  const [unlocked, setUnlocked] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [checking, setChecking] = useState(!!readPin())
  const [error, setError] = useState('')

  const [list, setList] = useState<LibraryBackground[] | null>(null)
  const [upload, setUpload] = useState<{ name: string; n: number; of: number; frac: number } | null>(null)
  const [note, setNote] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  /** Tags typed for the next batch of uploads (comma-separated). */
  const [batchTags, setBatchTags] = useState('')
  const [query, setQuery] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  /** The card whose "+ tag" box is open, and what is being typed in it. */
  const [tagging, setTagging] = useState<{ id: number; text: string } | null>(null)

  /** Every tag in the library, most used first — offered while typing. */
  const allTags = (() => {
    const n = new Map<string, number>()
    for (const b of list ?? []) for (const t of b.tags ?? []) n.set(t, (n.get(t) ?? 0) + 1)
    return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  })()
  const shown = (list ?? []).filter((b) => {
    if (tagFilter && !(b.tags ?? []).includes(tagFilter)) return false
    const q = query.trim().toLowerCase().replace(/^#/, '')
    return !q || b.name.toLowerCase().includes(q) || (b.tags ?? []).some((t) => t.includes(q))
  })

  const setTags = async (b: LibraryBackground, tags: string[]): Promise<void> => {
    const r = await updateBackground(pin, b.id, { tags })
    if (r.ok) setList((l) => (l ?? []).map((x) => (x.id === b.id ? r.background : x)))
    else setNote(r.message)
  }

  // A PIN kept from earlier in this tab is checked again rather than trusted.
  useEffect(() => {
    if (!pin) return
    void checkAdminPin(pin).then((r) => {
      setChecking(false)
      if (r.ok) setUnlocked(true)
      else {
        setPin('')
        try {
          sessionStorage.removeItem(PIN_KEY)
        } catch {
          /* private mode */
        }
      }
    })
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!unlocked) return
    void listBackgrounds().then((l) => {
      setList(l ?? [])
      if (!l) setNote('Couldn’t load the library. Check your connection.')
    })
  }, [unlocked])

  const unlock = async (): Promise<void> => {
    setChecking(true)
    setError('')
    const r = await checkAdminPin(pinInput)
    setChecking(false)
    if (!r.ok) {
      setError(r.message)
      return
    }
    setPin(pinInput)
    setUnlocked(true)
    try {
      sessionStorage.setItem(PIN_KEY, pinInput)
    } catch {
      /* private mode: it works for this visit */
    }
  }

  const addFiles = async (files: File[]): Promise<void> => {
    setNote('')
    const done: string[] = []
    const failed: string[] = []
    for (const [i, file] of files.entries()) {
      if (!file.type.startsWith('video/')) {
        failed.push(`${file.name}: not a video`)
        continue
      }
      const size = await videoSize(file)
      if (
        size &&
        Math.max(size.w, size.h) > 1920 &&
        !window.confirm(
          `“${file.name}” is ${size.w}×${size.h} — bigger than 1080p. The projector shows 1080p, and every computer has to download and play the full file. Upload it anyway?`
        )
      ) {
        failed.push(`${file.name}: skipped (larger than 1080p)`)
        continue
      }
      const name = file.name.replace(/\.[^.]+$/, '')
      setUpload({ name, n: i + 1, of: files.length, frac: 0 })
      const up = await uploadMedia(file, (frac) => setUpload({ name, n: i + 1, of: files.length, frac }))
      if (!up.ok) {
        failed.push(`${name}: ${up.message}`)
        continue
      }
      // What the name says it is, plus whatever was typed for this batch.
      const tags = [...new Set([...suggestTags(name), ...batchTags.split(',').map(cleanTag).filter(Boolean)])]
      const reg = await addBackground(pin, { name, url: up.url, kind: 'video', bytes: file.size, tags })
      if (!reg.ok) {
        failed.push(`${name}: ${reg.message}`)
        continue
      }
      setList((l) => [reg.background, ...(l ?? []).filter((b) => b.id !== reg.background.id)])
      done.push(name)
    }
    setUpload(null)
    setNote(
      [done.length ? `Added ${done.length} to the library — every Cantica will have it.` : '', ...failed]
        .filter(Boolean)
        .join(' ')
    )
  }

  const remove = async (b: LibraryBackground): Promise<void> => {
    if (!window.confirm(`Remove “${b.name}” from the library? It disappears from every Cantica’s background picker.`))
      return
    const r = await removeBackground(pin, b.id)
    if (r.ok) setList((l) => (l ?? []).filter((x) => x.id !== b.id))
    else setNote(r.message)
  }

  if (!unlocked) {
    return (
      <Screen
        title="Background Library"
        back={{ to: '/more', label: 'More' }}
        subtitle="Motion backgrounds for every Cantica. Admins only."
      >
        <Section>
          {checking && !pinInput ? (
            <div className="flex items-center justify-center gap-2.5 py-16 text-[15px] text-ink-muted">
              <span className="spinner" /> Just a moment…
            </div>
          ) : (
            <div className="px-[var(--gutter)]">
              <span className="list-label">Admin PIN</span>
              <input
                className="search-field mt-1 w-full"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.trim().slice(0, 32))}
                onKeyDown={(e) => e.key === 'Enter' && pinInput && void unlock()}
                aria-label="Admin PIN"
              />
              <button
                className="btn-app btn-app-primary btn-block mt-3"
                onClick={() => void unlock()}
                disabled={!pinInput || checking}
              >
                {checking ? 'Checking…' : 'Unlock'}
              </button>
              {error && <p className="mt-2 text-[13.5px] text-amber-700">{error}</p>}
              <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
                The same admin PIN as Send a notification.
              </p>
            </div>
          )}
        </Section>
      </Screen>
    )
  }

  return (
    <Screen
      title="Background Library"
      back={{ to: '/more', label: 'More' }}
      subtitle="Motion backgrounds every Cantica can use. Added and removed only here."
    >
      <Section>
        <div className="px-[var(--gutter)]">
          <input
            ref={fileInput}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              if (files.length) void addFiles(files)
            }}
          />
          <button
            className="btn-app btn-app-primary btn-block"
            disabled={!!upload}
            onClick={() => fileInput.current?.click()}
          >
            {upload
              ? `Uploading ${upload.name}${upload.of > 1 ? ` (${upload.n} of ${upload.of})` : ''} — ${Math.round(upload.frac * 100)}%`
              : 'Add video backgrounds…'}
          </button>
          {upload && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full bg-gold-500 transition-[width]" style={{ width: `${upload.frac * 100}%` }} />
            </div>
          )}
          <input
            className="search-field mt-3 w-full"
            type="text"
            placeholder="Tags for these uploads — e.g. christmas, warm"
            value={batchTags}
            onChange={(e) => setBatchTags(e.target.value)}
            list="bg-tag-options"
            aria-label="Tags for the next uploads"
          />
          <p className="mt-1 text-[12.5px] text-ink-muted">
            Tags are also suggested from each file’s name (“Christmas Candlelight …” → christmas, candles).
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
            Use <b>1080p (HD)</b> videos. Every computer keeps its own copy to play from, and a 4K file is about four
            times the size for the same picture on the projector.
          </p>
          {note && <p className="mt-2 text-[13.5px] leading-relaxed text-ink">{note}</p>}
        </div>
      </Section>

      <Section>
        <span className="list-label px-[var(--gutter)]">In the library{list ? ` · ${list.length}` : ''}</span>
        {list === null ? (
          <div className="flex items-center justify-center gap-2.5 py-12 text-[15px] text-ink-muted">
            <span className="spinner" /> Loading…
          </div>
        ) : !list.length ? (
          <p className="px-[var(--gutter)] text-[15px] text-ink-muted">Nothing yet — add the first one above.</p>
        ) : (
          <>
            {/* Find one: by name or tag, or by tapping a tag. */}
            <div className="mb-3 px-[var(--gutter)]">
              <input
                className="search-field w-full"
                type="search"
                placeholder="Search by name or tag"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search the library"
              />
              {allTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {allTags.map(([t, n]) => (
                    <button
                      key={t}
                      className={`rounded-full border px-2.5 py-1 text-[12.5px] font-semibold ${
                        tagFilter === t ? 'border-navy-700 bg-navy-700 text-white' : 'border-line bg-card text-ink'
                      }`}
                      onClick={() => setTagFilter((f) => (f === t ? null : t))}
                    >
                      #{t} <span className="opacity-60">{n}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!shown.length && <p className="px-[var(--gutter)] text-[14px] text-ink-muted">Nothing matches.</p>}
            <div className="grid grid-cols-2 gap-3 px-[var(--gutter)] sm:grid-cols-3">
              {shown.map((b) => (
                <div key={b.id} className="app-card !m-0 flex flex-col">
                  <video
                    className="aspect-video w-full bg-black object-cover"
                    src={`${b.url}#t=0.1`}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
                    onMouseLeave={(e) => e.currentTarget.pause()}
                  />
                  <div className="flex items-start gap-2 p-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">{b.name}</span>
                      <span className="block text-[12px] text-ink-muted">{mb(b.bytes)}</span>
                    </span>
                    <button
                      className="flex-none rounded-lg p-1.5 text-ink-muted hover:bg-line/60"
                      aria-label={`Remove ${b.name}`}
                      title="Remove from the library"
                      onClick={() => void remove(b)}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                  {/* Tags: tap × to drop one, + to add one (the library's own
                    tags are offered, so "christmas" doesn't become "xmas"). */}
                  <div className="flex flex-wrap items-center gap-1 px-2.5 pb-2.5">
                    {(b.tags ?? []).map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-0.5 rounded-full bg-line/60 py-0.5 pl-2 pr-1 text-[11.5px] text-ink"
                      >
                        #{t}
                        <button
                          className="rounded-full px-1 text-ink-muted hover:text-ink"
                          aria-label={`Remove tag ${t}`}
                          onClick={() =>
                            void setTags(
                              b,
                              (b.tags ?? []).filter((x) => x !== t)
                            )
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {tagging?.id === b.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          const add = tagging.text.split(',').map(cleanTag).filter(Boolean)
                          setTagging(null)
                          if (add.length) void setTags(b, [...new Set([...(b.tags ?? []), ...add])])
                        }}
                      >
                        <input
                          autoFocus
                          className="w-24 rounded-full border border-line bg-card px-2 py-0.5 text-[11.5px] outline-none"
                          value={tagging.text}
                          onChange={(e) => setTagging({ id: b.id, text: e.target.value })}
                          onBlur={() => setTagging(null)}
                          list="bg-tag-options"
                          placeholder="tag"
                          aria-label={`Add a tag to ${b.name}`}
                        />
                      </form>
                    ) : (
                      <button
                        className="rounded-full border border-dashed border-line px-2 py-0.5 text-[11.5px] text-ink-muted"
                        onClick={() => setTagging({ id: b.id, text: '' })}
                      >
                        + tag
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <datalist id="bg-tag-options">
          {allTags.map(([t]) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </Section>
    </Screen>
  )
}
