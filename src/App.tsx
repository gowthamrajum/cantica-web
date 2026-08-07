import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/app/AppShell'
import { Home } from './routes/Home'
import { Watch } from './routes/Watch'
import { Bible } from './routes/Bible'
import { Songs } from './routes/Songs'
import { SongDetail } from './routes/SongDetail'
import { More } from './routes/More'
import { Services } from './routes/Services'
import { Give } from './routes/Give'
import { Build } from './routes/Build'
import { Install } from './routes/Install'
import { Notifications } from './routes/Notifications'
import { Notify } from './routes/Notify'
import { Visit } from './routes/Visit'
import { About } from './routes/About'
import { Channel } from './routes/Channel'
import { Remote } from './routes/Remote'
import { Live } from './routes/Live'

/**
 * Two route families:
 *
 *  - Inside <AppShell/>: the tabbed app (Home · Watch · Bible · Songs · More)
 *    plus the screens pushed on top of a tab. The shell — and so the tab bar —
 *    never unmounts as you move between them.
 *  - Outside it: the full-screen live surfaces. The audience mirror, the
 *    operator remote and the presenter (which broadcasts a saved service from
 *    this device) take over the whole device, so they must not sit inside a
 *    shell that reserves space for chrome.
 */
export default function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/watch" element={<Watch />} />
        <Route path="/bible" element={<Bible />} />
        <Route path="/songs" element={<Songs />} />
        <Route path="/songs/:id" element={<SongDetail />} />
        <Route path="/more" element={<More />} />
        <Route path="/services" element={<Services />} />
        <Route path="/give" element={<Give />} />
        <Route path="/build" element={<Build />} />
        <Route path="/install" element={<Install />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/notify" element={<Notify />} />
        <Route path="/visit" element={<Visit />} />
        <Route path="/about" element={<About />} />
      </Route>

      <Route path="/c/:room" element={<Channel />} />
      <Route path="/remote" element={<Remote />} />
      <Route path="/live/:id" element={<Live />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
