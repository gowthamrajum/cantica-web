import { useState } from 'react'
import { Screen, Section } from '../components/app/Screen'
import { ListNote } from '../components/app/List'
import { Icon } from '../components/app/Icons'
import { checkPin, sendPush, type SendReport } from '../lib/push'

/** Enough for a lock-screen line on any phone; longer just gets cut off. */
const TITLE_MAX = 60
const BODY_MAX = 160

/** Where a tap on the notification should land. */
const DESTINATIONS = [
  { url: '/watch', label: 'The live service' },
  { url: '/', label: 'The home screen' },
  { url: '/services', label: 'Service times' },
  { url: '/give', label: 'Giving' }
] as const

/**
 * Sending a notification to the church.
 *
 * Behind a pin, and behind a confirmation, because this is the one screen in
 * the app whose button cannot be taken back: the moment it is pressed, every
 * phone that opted in lights up, and there is no recall. So the last step spells
 * out what is about to be sent and to how many people, rather than sending on
 * the first tap of "Send".
 *
 * The pin never travels anywhere but to the relay, which is the only thing that
 * knows it — nothing here can tell a good pin from a bad one on its own.
 */
export function Notify(): JSX.Element {
  const [pin, setPin] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [subscribers, setSubscribers] = useState(0)
  const [enabled, setEnabled] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState<string>('/watch')
  const [confirming, setConfirming] = useState(false)
  const [report, setReport] = useState<SendReport | null>(null)

  const unlock = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const r = await checkPin(pin)
    setBusy(false)
    if (!r.ok) {
      setError('That PIN didn’t match.')
      return
    }
    setSubscribers(r.subscribers)
    setEnabled(r.enabled)
    setUnlocked(true)
  }

  const send = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const r = await sendPush(pin, { title: title.trim(), body: body.trim(), url })
    setBusy(false)
    setConfirming(false)
    if (!r.ok) {
      setError(r.error === 'push-not-configured' ? 'Notifications aren’t switched on for the church yet.' : 'That didn’t send.')
      return
    }
    setReport(r.report)
    setSubscribers(r.report.subscribers - r.report.removed)
    setTitle('')
    setBody('')
  }

  if (!unlocked) {
    return (
      <Screen title="Send a notification" back={{ to: '/more', label: 'More' }} subtitle="For whoever looks after the church app.">
        <Section>
          <div className="px-[var(--gutter)]">
            <span className="list-label">PIN</span>
            <input
              className="search-field mt-1 w-full"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
              onKeyDown={(e) => e.key === 'Enter' && pin && void unlock()}
              aria-label="Admin PIN"
            />
            <button className="btn-app btn-app-primary btn-block mt-3" onClick={() => void unlock()} disabled={!pin || busy}>
              {busy ? 'Checking…' : 'Continue'}
            </button>
            {error && <p className="mt-2 text-center text-[13.5px] text-red-600">{error}</p>}
          </div>
        </Section>
      </Screen>
    )
  }

  const ready = title.trim().length > 0 && subscribers > 0 && enabled

  return (
    <Screen
      title="Send a notification"
      back={{ to: '/more', label: 'More' }}
      subtitle={`${subscribers.toLocaleString()} ${subscribers === 1 ? 'phone has' : 'phones have'} notifications on`}
    >
      {!enabled && (
        <Section>
          <p className="px-[var(--gutter)] text-[14px] text-amber-700">
            Notifications aren’t switched on for the church yet, so nothing can be sent.
          </p>
        </Section>
      )}

      <Section>
        <div className="px-[var(--gutter)]">
          <span className="list-label">Heading</span>
          <input
            className="search-field mt-1 w-full"
            value={title}
            maxLength={TITLE_MAX}
            placeholder="The service is starting"
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Notification heading"
          />
          <p className="mt-1 text-right text-[12px] text-ink-muted">{TITLE_MAX - title.length}</p>

          <span className="list-label mt-2 block">Message</span>
          <textarea
            className="search-field mt-1 w-full"
            rows={3}
            value={body}
            maxLength={BODY_MAX}
            placeholder="Join us — we’re live now."
            onChange={(e) => setBody(e.target.value)}
            aria-label="Notification message"
          />
          <p className="mt-1 text-right text-[12px] text-ink-muted">{BODY_MAX - body.length}</p>

          <span className="list-label mt-2 block">Opens</span>
          <div className="list-group mt-1">
            {DESTINATIONS.map((d) => (
              <button
                key={d.url}
                type="button"
                className="list-row w-full text-left"
                onClick={() => setUrl(d.url)}
                aria-pressed={url === d.url}
              >
                <span className="min-w-0 flex-1">
                  <span className="list-title block">{d.label}</span>
                </span>
                {url === d.url && <Icon name="check" size={18} />}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* What it will look like on a lock screen. Cheap to render and it is the
          only way to notice a heading that reads fine in a text box and badly
          in the two lines a phone actually gives it. */}
      {title.trim() && (
        <Section>
          <span className="list-label">On their phone</span>
          <div className="mx-[var(--gutter)] mt-1 rounded-2xl bg-navy-700 p-3.5 text-paper">
            <div className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-gold-500 font-serif text-[15px] font-bold text-navy-900">
                ♪
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{title.trim()}</span>
                {body.trim() && <span className="mt-0.5 block text-[13px] leading-snug text-paper/75">{body.trim()}</span>}
              </span>
            </div>
          </div>
        </Section>
      )}

      <Section>
        <div className="px-[var(--gutter)]">
          {confirming ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-[14.5px] leading-relaxed text-amber-900">
                Send <b>“{title.trim()}”</b> to {subscribers.toLocaleString()}{' '}
                {subscribers === 1 ? 'phone' : 'phones'}? This can’t be taken back.
              </p>
              <div className="mt-3 flex gap-2">
                <button className="btn-app btn-app-quiet flex-1" onClick={() => setConfirming(false)} disabled={busy}>
                  Not yet
                </button>
                <button className="btn-app btn-app-primary flex-1" onClick={() => void send()} disabled={busy}>
                  {busy ? 'Sending…' : 'Send it'}
                </button>
              </div>
            </div>
          ) : (
            <button className="btn-app btn-app-primary btn-block" onClick={() => setConfirming(true)} disabled={!ready}>
              Send
            </button>
          )}
          {!ready && !confirming && (
            <p className="mt-2 text-center text-[13px] text-ink-muted">
              {subscribers === 0 ? 'Nobody has notifications on yet.' : 'A heading is needed.'}
            </p>
          )}
          {error && <p className="mt-2 text-center text-[13.5px] text-red-600">{error}</p>}
          {report && (
            <p className="mt-3 text-center text-[13.5px] text-ink-muted">
              Sent to {report.sent.toLocaleString()} {report.sent === 1 ? 'phone' : 'phones'}.
              {report.removed > 0 && ` ${report.removed} had uninstalled and were dropped.`}
              {report.failed > 0 && ` ${report.failed} couldn’t be reached — they’ll get the next one.`}
            </p>
          )}
        </div>
      </Section>

      <ListNote>
        Send sparingly. A phone that gets too many turns notifications off, and it never asks again.
      </ListNote>
    </Screen>
  )
}
