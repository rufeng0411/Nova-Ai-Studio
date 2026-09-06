import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import '@fontsource-variable/inter'
import './index.css'
import 'katex/dist/katex.min.css'

// Initialize i18n
import './i18n/config.js'

// PD-SAAS-FORK: register the PWA/Web-Push service worker in production only.
// In dev, an active SW caches stale assets and breaks Vite HMR (stuck Loading /
// white screen / Offline page). We also proactively unregister any SW + clear
// caches left over from a previous prod build so local dev is never poisoned.
if ('serviceWorker' in navigator) {
 if (import.meta.env.PROD) {
 navigator.serviceWorker.register('/sw.js').catch(err => {
 console.warn('Service worker registration failed:', err);
 });
 } else {
 navigator.serviceWorker.getRegistrations()
 .then(regs => regs.forEach(r => r.unregister()))
 .catch(() => {});
 if (window.caches?.keys) {
 caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
 }
 }
}

ReactDOM.createRoot(document.getElementById('root')).render(
 <React.StrictMode>
 <App />
 </React.StrictMode>,
)
