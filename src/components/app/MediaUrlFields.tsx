import { useState } from 'react'
import { backgroundForUrl, defaultMediaName, withScheme } from '../../lib/deckItems'

/**
 * A link to something already online — the zero-cost half of adding media.
 *
 * What the link IS gets worked out rather than asked: YouTube from the host,
 * image or audio from the extension, and anything else played as video, which
 * is what almost every link in a service turns out to be. The one-line summary
 * under the field says which it decided, so a wrong guess is visible before it
 * is in the order rather than as a black frame on Sunday.
 */
export function MediaUrlFields({
  onAdd,
  onCancel
}: {
  onAdd: (url: string, name: string) => void
  onCancel: () => void
}): JSX.Element {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')

  const bg = url.trim() ? backgroundForUrl(url) : null
  const suggested = bg ? defaultMediaName(url, bg) : ''
  const what =
    bg?.type === 'youtube'
      ? 'A YouTube video — it plays on the audience screen.'
      : bg?.type === 'image'
        ? 'A photo — it shows as a full-screen backdrop.'
        : bg?.type === 'audio'
          ? 'An audio track — it plays with nothing on screen.'
          : bg
            ? 'Played as a video. If it turns out to be a photo, use a link ending in .jpg or .png.'
            : url.trim()
              ? 'That doesn’t look like a web address.'
              : ''

  return (
    <div className="px-[var(--gutter)] pb-1">
      <label className="mb-3 block">
        <span className="list-label">Address</span>
        <input
          className="search-field mt-1 w-full"
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Paste a YouTube link, or a link to a video or photo"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>
      <label className="mb-3 block">
        <span className="list-label">Name it</span>
        <input
          className="search-field mt-1 w-full"
          type="text"
          placeholder={suggested ? `“${suggested}”` : 'Shown in the order — optional'}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      {what && (
        <p className={`mb-3 text-[13px] leading-relaxed ${bg ? 'text-ink-muted' : 'text-amber-700'}`}>{what}</p>
      )}

      <button
        className="btn-app btn-app-primary btn-block"
        disabled={!bg}
        onClick={() => onAdd(withScheme(url), name.trim() || suggested)}
      >
        Add it
      </button>
      <button className="btn-app btn-app-quiet btn-block mt-2 text-[15px]" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
