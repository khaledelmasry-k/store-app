import { render } from 'preact'
import './index.css'
import './styles/dark-mode-v2.css'
import App from './App'
import { ErrorBoundary } from './shared/components/routing/ErrorBoundary'

// A deployment replaces hashed lazy chunks. If a browser is still running an
// older entry bundle, Vite reports a preload error when it requests a removed
// chunk. Reload once to obtain the current entry bundle instead of leaving a
// blank route behind.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const retryKey = 'matjari:lazy-chunk-retry'
  try {
    if (sessionStorage.getItem(retryKey) === '1') return
    sessionStorage.setItem(retryKey, '1')
  } catch {
    // Reloading is still safer than rendering a blank page when storage is unavailable.
  }
  window.location.reload()
})

render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
  document.getElementById('root')!
)
