import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initLiveUpdates } from './services/liveUpdate'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Confirm this bundle booted OK and check for a newer one in the background.
initLiveUpdates()
