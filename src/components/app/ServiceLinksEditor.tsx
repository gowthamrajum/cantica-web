import { useState } from 'react'
import { Icon } from './Icons'
import { defaultLabel, toLink, withScheme, type ServiceLink } from '../../lib/links'

/**
 * The links that belong to one service — this Sunday's stream, a meeting room,
 * the week's notes.
 *
 * Only the address is asked for. A label can be typed, but a YouTube link left
 * unnamed calls itself "Watch on YouTube", which is what anyone would have
 * written; making it a required field would mean typing that out every week.
 *
 * The address is the identity here, so pasting one that is already in the list
 * is refused rather than silently added a second time.
 */
export function ServiceLinksEditor({
  links,
  onChange
}: {
  links: ServiceLink[]
  onChange: (next: ServiceLink[]) => void
}): JSX.Element {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')

  const add = (): void => {
    const link = toLink(label, url)
    if (!link) {
      setError('Paste the address first.')
      return
    }
    if (links.some((l) => l.url === link.url)) {
      setError('That link is already here.')
      return
    }
    onChange([...links, link])
    setUrl('')
    setLabel('')
    setError('')
  }

  const removeAt = (i: number): void => onChange(links.filter((_, j) => j !== i))

  return (
    <>
      {links.length > 0 && (
        <div className="list-group mt-1">
          {links.map((l, i) => (
            <div key={l.url} className="list-row has-ico">
              <span
                className={`list-ico ${
                  l.kind === 'youtube' ? 'bg-red-500' : l.kind === 'zoom' ? 'bg-navy-500' : 'bg-navy-700'
                }`}
              >
                <Icon name={l.kind === 'youtube' ? 'watch' : l.kind === 'zoom' ? 'people' : 'globe'} size={18} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="list-title block truncate">{l.label}</span>
                {/* The address in full: the one thing worth checking before a
                    hundred people tap it. */}
                <span className="list-sub block break-all">{l.url}</span>
              </span>
              <button type="button" className="icon-btn" onClick={() => removeAt(i)} aria-label={`Remove ${l.label}`}>
                <Icon name="close" size={17} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 space-y-2 px-[var(--gutter)]">
        <input
          className="search-field w-full"
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Paste a link — YouTube, Zoom, anything"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setError('')
          }}
        />
        <input
          className="search-field w-full"
          type="text"
          placeholder={url.trim() ? `Name it — “${defaultLabel(withScheme(url))}”` : 'Name it (optional)'}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button type="button" className="btn-app btn-app-quiet btn-block text-[15px]" onClick={add} disabled={!url.trim()}>
          <Icon name="plus" size={17} strokeWidth={2.4} /> Add link
        </button>
        {error ? (
          <p className="text-[13px] text-amber-700">{error}</p>
        ) : (
          <p className="text-[13px] leading-relaxed text-ink-muted">
            Saved with the service and printed on the shared sheet, so whoever reads from it has the stream to hand.
          </p>
        )}
      </div>
    </>
  )
}
