import { useEffect, useState } from 'react'
import { Screen, Section } from '../components/app/Screen'
import { ListGroup, ListRow } from '../components/app/List'
import { Icon } from '../components/app/Icons'
import { CHURCH } from '../lib/church'
import { SITE_ORIGIN } from '../lib/site'

/**
 * Getting the app onto a phone.
 *
 * There is no file to send: a web app can't be installed from an attachment on
 * either platform. What travels is the LINK, and each phone adds it its own way
 * — Android can be prompted programmatically, iOS cannot and has to be walked
 * through Share ▸ Add to Home Screen. So this screen shares the link, shows a
 * QR for the projector, and tells each visitor the steps their own phone needs.
 */

/** The one place the domain is written down. The QR image beside this on the
 *  screen is generated from the same constant — see lib/site. */
const APP_URL = SITE_ORIGIN

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'ios' | 'android' | 'desktop'

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua))) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

export function Install(): JSX.Element {
  const [platform] = useState<Platform>(detectPlatform)
  const [installed, setInstalled] = useState(false)
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    const standalone =
      (navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    setInstalled(standalone)
    // Android/Chrome offers this; iOS never fires it.
    const onPrompt = (e: Event): void => {
      e.preventDefault()
      setPrompt(e as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const share = async (): Promise<void> => {
    const data = {
      title: CHURCH.name,
      text: `${CHURCH.name} — songs, the Bible in Telugu and English, and Sunday's service live.`,
      url: APP_URL
    }
    try {
      if (navigator.share) {
        await navigator.share(data)
        return
      }
      await navigator.clipboard.writeText(APP_URL)
      setNote('Link copied — paste it into your group.')
    } catch {
      /* the sheet was dismissed; nothing to report */
    }
  }

  const install = async (): Promise<void> => {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    setPrompt(null)
    if (outcome === 'accepted') setInstalled(true)
  }

  return (
    <Screen
      title="Add to your phone"
      back={{ to: '/more', label: 'More' }}
      subtitle="Keep the songs, the Bible and the live service one tap away."
    >
      {installed ? (
        <Section>
          <div className="mx-[var(--gutter)] rounded-2xl bg-white/70 p-4 text-center">
            <Icon name="check" size={26} />
            <p className="mt-2 text-[15px] font-semibold">You're all set</p>
            <p className="mt-1 text-[13.5px] text-ink-muted">
              This is running as an installed app. Share it with someone else below.
            </p>
          </div>
        </Section>
      ) : (
        <Section>
          {/* Android can be asked outright; every other phone gets steps. */}
          {prompt ? (
            <div className="px-[var(--gutter)]">
              <button className="btn-app btn-app-primary btn-block" onClick={() => void install()}>
                Install this app
              </button>
            </div>
          ) : (
            <ListGroup label={platform === 'ios' ? 'On iPhone or iPad' : 'On this device'}>
              {platform === 'ios' ? (
                <>
                  <ListRow icon="external" tint="navy" title="1. Open in Safari" subtitle="Chrome on iPhone can't add to the Home Screen" chevron={false} />
                  <ListRow icon="plus" tint="gold" title="2. Tap Share, then Add to Home Screen" subtitle="The Share button is the square with an arrow" chevron={false} />
                  <ListRow icon="check" tint="green" title="3. Tap Add" subtitle="It appears with the church icon, like any app" chevron={false} />
                </>
              ) : (
                <>
                  <ListRow icon="more" tint="navy" title="1. Open the browser menu" subtitle="The ⋮ or ⋯ button" chevron={false} />
                  <ListRow icon="plus" tint="gold" title="2. Choose Install app or Add to Home screen" chevron={false} />
                  <ListRow icon="check" tint="green" title="3. Confirm" subtitle="It appears with the church icon" chevron={false} />
                </>
              )}
            </ListGroup>
          )}
        </Section>
      )}

      <Section>
        <div className="px-[var(--gutter)]">
          <button className="btn-app btn-app-quiet btn-block" onClick={() => void share()}>
            Share the app with your group
          </button>
          {note && <p className="mt-2 text-center text-[13px] text-ink-muted">{note}</p>}
        </div>
      </Section>

      <Section>
        <p className="list-label">Or scan this</p>
        <div className="mx-[var(--gutter)] mt-1 rounded-2xl bg-white p-4 text-center">
          <img
            src="/install-qr.png"
            alt={`QR code linking to ${APP_URL}`}
            className="mx-auto h-auto w-full max-w-[240px]"
          />
          <p className="mt-3 text-[13px] text-ink-muted">
            Put this on the screen after the service — a phone camera opens it straight to the app.
          </p>
        </div>
      </Section>

      <Section>
        <p className="px-[var(--gutter)] text-[13px] leading-relaxed text-ink-muted">
          There's no file to send: phones don't install a web app from an attachment. Sharing the
          link is the install — each phone adds it from its own browser, and it then opens
          full-screen with its own icon, works offline for songs and the Bible, and updates itself.
        </p>
      </Section>
    </Screen>
  )
}
