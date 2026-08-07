import { useEffect, useState } from 'react'
import { Screen, Section } from './Screen'
import { builderPinRequired, builderUnlocked, unlockBuilder } from '../../lib/access'

/**
 * The PIN in front of the Service Builder.
 *
 * Not security — the songs and the Bible are public, and anyone determined can
 * read the relay. It is a door: the builder writes the order the whole church
 * follows on Sunday, and it lives one tap from the More menu on a phone that
 * gets passed around. A door stops the accident, which is the thing that
 * actually happens.
 *
 * Unlocked for the session, not remembered: a shared phone in the sound booth
 * should not still be open next week.
 */
export function BuilderGate({ children }: { children: JSX.Element }): JSX.Element {
  const [required, setRequired] = useState<boolean | null>(null)
  const [open, setOpen] = useState(builderUnlocked())
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void builderPinRequired().then(setRequired)
  }, [])

  const submit = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const ok = await unlockBuilder(pin)
    setBusy(false)
    if (ok) setOpen(true)
    else setError('That PIN didn’t match.')
  }

  // Nothing is shown until the relay has answered. Rendering the gate first and
  // then whipping it away is worse than a moment of nothing, and rendering the
  // builder first would flash the very screen the gate exists to withhold.
  if (required === null) {
    return (
      <Screen title="Service Builder" back={{ to: '/more', label: 'More' }}>
        <div className="flex items-center justify-center gap-2.5 py-20 text-[15px] text-ink-muted">
          <span className="spinner" /> Just a moment…
        </div>
      </Screen>
    )
  }
  if (!required || open) return children

  return (
    <Screen
      title="Service Builder"
      back={{ to: '/more', label: 'More' }}
      subtitle="For whoever puts Sunday's order together."
    >
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
            onKeyDown={(e) => e.key === 'Enter' && pin && void submit()}
            aria-label="Service Builder PIN"
          />
          <button className="btn-app btn-app-primary btn-block mt-3" onClick={() => void submit()} disabled={!pin || busy}>
            {busy ? 'Checking…' : 'Continue'}
          </button>
          {error && <p className="mt-2 text-center text-[13.5px] text-red-600">{error}</p>}
        </div>
      </Section>
    </Screen>
  )
}
