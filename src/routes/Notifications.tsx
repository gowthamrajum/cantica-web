import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Screen, Section } from '../components/app/Screen'
import { ListGroup, ListRow, ListNote } from '../components/app/List'
import { Icon } from '../components/app/Icons'
import { pushState, enablePush, disablePush, type PushState } from '../lib/push'

/**
 * Turning notifications on, for whoever is holding the phone.
 *
 * The permission prompt is a one-shot: a browser that has been refused once
 * will not ask again, and Chrome holds an unprompted request against the site.
 * So nothing here happens on load — the ask is behind a button, and the reasons
 * to say yes are on screen before the button is.
 */
export function Notifications(): JSX.Element {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const refresh = (): void => {
    void pushState().then(setState)
  }
  useEffect(refresh, [])

  const turnOn = async (): Promise<void> => {
    setBusy(true)
    setNote(null)
    const r = await enablePush()
    setBusy(false)
    if (r.ok) setNote('Notifications are on for this phone.')
    else
      setNote(
        r.reason === 'denied'
          ? 'This phone has notifications blocked for the app. Turn them back on in its settings, then come back.'
          : r.reason === 'not-configured'
            ? 'Notifications aren’t switched on for the church yet.'
            : r.reason === 'install-first'
              ? 'Add the app to your Home Screen first.'
              : r.reason === 'unsupported'
                ? 'This browser can’t do notifications.'
                : 'That didn’t work. Try again in a moment.'
      )
    refresh()
  }

  const turnOff = async (): Promise<void> => {
    setBusy(true)
    setNote(null)
    await disablePush()
    setBusy(false)
    setNote('Notifications are off for this phone.')
    refresh()
  }

  const blocked = state?.permission === 'denied'

  return (
    <Screen
      title="Notifications"
      back={{ to: '/more', label: 'More' }}
      subtitle="A note when the service goes live, and the occasional word from the church."
    >
      <Section>
        <ListGroup label="What you’d hear about">
          <ListRow icon="watch" tint="red" title="When the service starts" subtitle="So you can join from wherever you are" chevron={false} />
          <ListRow icon="calendar" tint="navy" title="Sunday and special services" subtitle="A reminder, not a stream of them" chevron={false} />
        </ListGroup>
      </Section>

      {state === null ? (
        <div className="flex items-center justify-center gap-2.5 py-10 text-[14px] text-ink-muted">
          <span className="spinner" /> Checking…
        </div>
      ) : !state.supported ? (
        <Section>
          <p className="px-[var(--gutter)] text-[14.5px] leading-relaxed text-ink-muted">
            This browser can’t show notifications. Safari on iPhone and Chrome on Android both can.
          </p>
        </Section>
      ) : state.installFirst ? (
        /* On iPhone this is not a permission problem, it is an install one:
           iOS delivers push only to an app on the Home Screen, never to a tab.
           Asking here would spend the one prompt on something that cannot work. */
        <Section>
          <div className="mx-[var(--gutter)] rounded-2xl bg-white/70 p-4 text-center">
            <Icon name="plus" size={24} />
            <p className="mt-2 text-[15px] font-semibold">Add the app to your Home Screen first</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">
              On iPhone, notifications only reach the app once it’s on your Home Screen. It takes two taps.
            </p>
            <Link to="/install" className="btn-app btn-app-primary btn-block mt-3.5">
              Show me how
            </Link>
          </div>
        </Section>
      ) : !state.configured ? (
        <Section>
          <p className="px-[var(--gutter)] text-[14.5px] leading-relaxed text-ink-muted">
            Notifications aren’t switched on for the church yet. Nothing to do here for now.
          </p>
        </Section>
      ) : (
        <Section>
          <div className="px-[var(--gutter)]">
            {state.subscribed ? (
              <>
                <div className="mb-3 flex items-center justify-center gap-2 text-[14.5px] text-emerald-700">
                  <Icon name="check" size={18} /> On for this phone
                </div>
                <button className="btn-app btn-app-quiet btn-block" onClick={() => void turnOff()} disabled={busy}>
                  {busy ? 'Just a moment…' : 'Turn off'}
                </button>
              </>
            ) : (
              <button className="btn-app btn-app-primary btn-block" onClick={() => void turnOn()} disabled={busy || blocked}>
                {busy ? 'Just a moment…' : 'Turn on notifications'}
              </button>
            )}
            {note && <p className="mt-2.5 text-center text-[13.5px] text-ink-muted">{note}</p>}
          </div>
        </Section>
      )}

      <ListNote>
        Notifications are per phone — turning them on here doesn’t turn them on anywhere else you use the app.
      </ListNote>
    </Screen>
  )
}
