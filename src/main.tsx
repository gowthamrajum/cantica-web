import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Self-updating PWA: check for new deploys periodically, on focus, and on reconnect.
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_url, r) {
    if (!r) return
    const check = (): void => {
      if (!document.hidden) void r.update()
    }
    setInterval(check, 30 * 60 * 1000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('online', check)
  },
  onNeedRefresh() {
    void updateSW(true)
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>
)
