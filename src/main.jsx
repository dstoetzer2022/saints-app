import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// Phase 4.3: register the app-shell service worker. Guarded (some
// environments — Base44's own preview iframe, older Safari — don't expose
// serviceWorker) and fire-and-forget: a registration failure must never
// affect the app itself, it just means no offline app-shell this session.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('[saints] service worker registration failed:', err);
    });
  });
}
