import { useState } from 'react'
import { prettyServiceName } from '../lib/format'

export type StatusTone = 'live' | 'wait' | 'conn'

/**
 * The overlay chrome for the full-screen mirror, shared by the audience Channel
 * and the Operator remote. A back arrow stays top-left; the service details
 * (name + status + live watcher count) collapse under an info button on the
 * top-right, so they never sit over the slide unless tapped. Rendered inside the
 * rotor, so it rotates with the slide and reads correctly on a portrait phone.
 */
export function MirrorChrome({
  name,
  statusLabel,
  tone,
  onBack,
  backLabel = 'Back to services',
  watchers
}: {
  name?: string
  statusLabel: string
  tone: StatusTone
  onBack: () => void
  backLabel?: string
  watchers?: number | null
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const hasCount = typeof watchers === 'number' && watchers >= 0

  return (
    <>
      {open && <div className="channel-info-catch" onClick={() => setOpen(false)} />}

      <div className="channel-chrome">
        <button type="button" onClick={onBack} aria-label={backLabel} className="channel-back">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      <div className="channel-info-wrap">
        <button
          type="button"
          className={`channel-info-btn ${open ? 'is-open' : ''}`}
          aria-label="Service details"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {hasCount ? (
            <>
              <EyeIcon />
              <span className="channel-info-count">{watchers}</span>
            </>
          ) : (
            <span className="channel-info-i">i</span>
          )}
        </button>

        {open && (
          <div className="channel-info-pop" role="dialog" aria-label="Service details">
            <div className="channel-name">{prettyServiceName(name) || 'Live service'}</div>
            <div className="channel-status">
              <span className={`channel-dot is-${tone}`} />
              {statusLabel}
            </div>
            {hasCount && (
              <div className="channel-watchers">
                <EyeIcon />
                {watchers} watching now
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function EyeIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
