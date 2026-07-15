import { Link, useParams } from 'react-router-dom'
import { useLiveState } from '../lib/useLiveState'
import { Stage } from '../components/Stage'

export function Channel(): JSX.Element {
  const { room = '' } = useParams()
  const { state, connected } = useLiveState(room)
  const liveShowing = !!state?.slide && !state.blackout && !state.clearText && !state.showLogo

  return (
    <div className="channel-root">
      {/* The slide fills the screen (16:9, rotates on portrait). */}
      <div className="channel-frame">
        <Stage state={state} />
      </div>

      {/* Chrome lives in screen space (not the rotating/cropped frame) so the back
          button is always visible in the corner, below the notch. */}
      <div className="channel-chrome">
        <Link to="/watch" aria-label="Back to services" className="channel-back">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="channel-meta">
          <span className="channel-name">{state?.name || 'Live Service'}</span>
          <span className="channel-status">
            <span className={`channel-dot ${liveShowing ? 'is-live' : connected ? 'is-wait' : 'is-conn'}`} />
            {liveShowing ? 'Live' : connected ? 'Waiting' : 'Connecting'}
          </span>
        </div>
      </div>
    </div>
  )
}
