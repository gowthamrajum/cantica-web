import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveState } from '../lib/useLiveState'
import { Stage } from '../components/Stage'

export function Channel(): JSX.Element {
  const { room = '' } = useParams()
  const { state, connected } = useLiveState(room)
  const [chrome, setChrome] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Is real content on screen (vs. standby/blank)? Auto-hide the chrome only then.
  const liveShowing = !!state?.slide && !state.blackout && !state.clearText && !state.showLogo

  const poke = useCallback(() => {
    setChrome(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (liveShowing) hideTimer.current = setTimeout(() => setChrome(false), 2800)
  }, [liveShowing])

  useEffect(() => {
    poke()
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [poke])

  return (
    // The slide is a fixed 16:9 landscape stage. On a portrait phone the frame
    // rotates 90° to fill the screen, so slides are always shown landscape.
    <div className="channel-root" onMouseMove={poke} onTouchStart={poke}>
      <div className="channel-frame">
        <Stage state={state} />

        <div className={`pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-4 transition-opacity duration-500 ${chrome ? 'opacity-100' : 'opacity-0'}`}>
          <div className="pointer-events-auto flex items-center gap-3">
            <Link to="/watch" aria-label="Back to services" className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </Link>
            <div className="min-w-0">
              <div className="truncate font-serif text-lg font-semibold text-white drop-shadow">{state?.name || 'Live Service'}</div>
              <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-white/80">
                <span className={`h-1.5 w-1.5 rounded-full ${liveShowing ? 'animate-pulse bg-red-500' : connected ? 'bg-gold-400' : 'bg-white/40'}`} />
                {liveShowing ? 'Live' : connected ? 'Waiting' : 'Connecting'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
