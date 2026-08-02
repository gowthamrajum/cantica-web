import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icons'
import { Logo } from '../Logo'

/**
 * Offers to put the app on the home screen, unprompted, on a first visit.
 *
 * No platform will do this without the visitor's own taps — there is no API to
 * add a home-screen icon, on either OS, and that is deliberate. The nearest
 * honest thing is to stop making them hunt for it: Android is asked outright
 * (one tap), and iOS — which cannot be prompted at all — is shown exactly where
 * its Share button is.
 *
 * Shown once. Dismiss it and it stays dismissed.
 */

const DISMISSED = 'tcc-install-dismissed'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** iOS Safari's share glyph, so the instruction points at something recognisable. */
function ShareGlyph(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M8.5 6.5 12 3l3.5 3.5" />
      <path d="M6 12.5v6.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5v-6.5" />
    </svg>
  )
}

export function InstallBanner(): JSX.Element | null {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    const standalone =
      (navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    if (standalone) return
    let dismissed = false
    try {
      dismissed = localStorage.getItem(DISMISSED) === '1'
    } catch {
      /* private mode — just show it */
    }
    if (dismissed) return

    const ua = navigator.userAgent
    const isIos = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua)
    const isAndroid = /Android/.test(ua)
    setIos(isIos)

    // Android tells us when it's installable; iOS never will, so it gets the
    // instruction after a beat rather than the moment the app paints.
    const onPrompt = (e: Event): void => {
      e.preventDefault()
      setPrompt(e as InstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    const t = isIos ? setTimeout(() => setShow(true), 2500) : undefined
    // Chrome on iOS can't add to the Home Screen at all, so don't ask there.
    if (!isIos && !isAndroid) window.removeEventListener('beforeinstallprompt', onPrompt)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      if (t) clearTimeout(t)
    }
  }, [])

  const close = (): void => {
    setShow(false)
    try {
      localStorage.setItem(DISMISSED, '1')
    } catch {
      /* nothing to remember it with; it'll offer again */
    }
  }

  const add = async (): Promise<void> => {
    if (!prompt) return
    await prompt.prompt()
    await prompt.userChoice
    setPrompt(null)
    close()
  }

  if (!show) return null

  return (
    <div className="install-banner no-select" role="dialog" aria-label="Add to home screen">
      <Logo className="h-9 w-9 flex-none" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-tight">Add to your home screen</p>
        {ios ? (
          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[12.5px] leading-tight text-ink-muted">
            Tap <ShareGlyph /> then <b>Add to Home Screen</b>
          </p>
        ) : (
          <p className="mt-0.5 text-[12.5px] leading-tight text-ink-muted">
            Opens full screen and works offline.
          </p>
        )}
      </div>
      {prompt ? (
        <button className="btn-app btn-app-primary flex-none px-4 text-[14px]" onClick={() => void add()}>
          Add
        </button>
      ) : (
        !ios && (
          <Link className="btn-app btn-app-primary flex-none px-4 text-[14px]" to="/install" onClick={close}>
            How
          </Link>
        )
      )}
      <button className="icon-btn flex-none" onClick={close} aria-label="Not now">
        <Icon name="close" size={17} />
      </button>
    </div>
  )
}
