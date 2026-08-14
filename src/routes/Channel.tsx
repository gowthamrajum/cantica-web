import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveState } from '../lib/useLiveState'
import { useScreenVars } from '../lib/screenVars'
import { ConfidenceDeck } from '../components/ConfidenceDeck'
import { Icon } from '../components/app/Icons'
import { prettyServiceName } from '../lib/format'

/**
 * What the congregation follows on their own phone.
 *
 * The same two cards the operator gets, for the same reason: a 16:9 mirror of
 * the hall screen is faithful but tiny in the hand, and the line you are about
 * to sing is worth more to someone singing than an accurate letterbox. The
 * layout, the sizing and the rotation are shared with the remote (see
 * ConfidenceDeck) so the two cannot drift apart.
 *
 * No controls: this screen only ever reads. The relay projects the `users`
 * slice, so an item the desktop holds back from the congregation never reaches
 * here at all — including its next slide, which is why the empty card says
 * nothing rather than claiming the service has ended.
 */
export function Channel(): JSX.Element {
  const { room = '' } = useParams()
  const navigate = useNavigate()
  const { state, connected, viewers } = useLiveState(room)
  const liveShowing = !!state?.slide && !state.blackout && !state.clearText && !state.showLogo

  // Black the whole document so no paper page background shows through the
  // status-bar / home-indicator safe areas.
  useEffect(() => {
    const html = document.documentElement
    html.classList.add('channel-open')
    return () => html.classList.remove('channel-open')
  }, [])

  // The rotated root is sized from the JS-measured screen, not viewport units.
  useScreenVars()

  const status = liveShowing
    ? { label: 'LIVE', cls: 'bg-red-500 text-white' }
    : connected
      ? { label: 'WAITING', cls: 'bg-white/15 text-white/70' }
      : { label: 'CONNECTING', cls: 'bg-white/10 text-white/45' }

  return (
    <div className="op2-root">
      <header className="op2-head">
        <div className="op2-headmain">
          <h1 className="op2-service">{prettyServiceName(state?.name) || 'Live service'}</h1>
        </div>
        <div className="op2-badges">
          {/* Who else is here — on the audience screen, where the number means
              something. The operator's own count is always one. */}
          {!!viewers && viewers > 0 && (
            <span className="op2-viewers">
              <Icon name="eye" size={13} />
              {viewers}
            </span>
          )}
          <span className={`op2-status ${status.cls}`}>{status.label}</span>
          <button onClick={() => navigate('/watch')} aria-label="Leave" className="op2-exit">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </header>

      <div className="op2-body">
        <ConfidenceDeck state={state} emptyNext="" />
      </div>
    </div>
  )
}
