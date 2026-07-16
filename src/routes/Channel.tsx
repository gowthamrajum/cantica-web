import { useNavigate, useParams } from 'react-router-dom'
import { useLiveState } from '../lib/useLiveState'
import { LiveMirror } from '../components/LiveMirror'
import { MirrorChrome } from '../components/MirrorChrome'

export function Channel(): JSX.Element {
  const { room = '' } = useParams()
  const navigate = useNavigate()
  const { state, connected, viewers } = useLiveState(room)
  const liveShowing = !!state?.slide && !state.blackout && !state.clearText && !state.showLogo

  return (
    <LiveMirror
      state={state}
      chrome={
        <MirrorChrome
          name={state?.name}
          tone={liveShowing ? 'live' : connected ? 'wait' : 'conn'}
          statusLabel={liveShowing ? 'Live' : connected ? 'Waiting' : 'Connecting'}
          onBack={() => navigate('/watch')}
          watchers={viewers}
        />
      }
    />
  )
}
