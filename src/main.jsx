import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initLiveUpdates } from './services/liveUpdate'
import { applyTheme, loadCachedTheme, applyDisplay, loadCachedDisplay } from './services/theme'

// Apply the saved appearance before the first paint so there's no flash of the
// wrong theme. The database re-confirms it once it loads.
applyTheme(loadCachedTheme())
applyDisplay(loadCachedDisplay())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Confirm this bundle booted OK and check for a newer one in the background.
initLiveUpdates()
