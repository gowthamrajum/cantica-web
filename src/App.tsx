import { Routes, Route, Navigate } from 'react-router-dom'
import { Landing } from './routes/Landing'
import { Watch } from './routes/Watch'
import { Channel } from './routes/Channel'
import { Bible } from './routes/Bible'
import { Songs } from './routes/Songs'
import { SongDetail } from './routes/SongDetail'
import { Remote } from './routes/Remote'

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/watch" element={<Watch />} />
      <Route path="/c/:room" element={<Channel />} />
      <Route path="/remote" element={<Remote />} />
      <Route path="/bible" element={<Bible />} />
      <Route path="/songs" element={<Songs />} />
      <Route path="/songs/:id" element={<SongDetail />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
