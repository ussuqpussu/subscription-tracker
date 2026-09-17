import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './styles/tokens.css'
import './styles/base.css'
import './styles/glass.css'
import './styles/surfaces.css'
import App from './App'

// Способ ввода для CSS: кольцо фокуса показываем только тем, кто управляет с клавиатуры.
const root = document.documentElement
root.dataset.input = 'pointer'
window.addEventListener('pointerdown', () => (root.dataset.input = 'pointer'), { capture: true, passive: true })
window.addEventListener(
  'keydown',
  (event) => {
    if (event.key === 'Tab' || event.key.startsWith('Arrow') || event.key === 'Enter' || event.key === ' ') {
      root.dataset.input = 'keyboard'
    }
  },
  { capture: true },
)

// Service worker кэширует приложение: после установки на экран «Домой» оно открывается без сети.
registerSW({ immediate: true })

// Просим браузер не вытеснять localStorage при нехватке места. Отказ не критичен.
navigator.storage?.persist?.().catch(() => undefined)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
