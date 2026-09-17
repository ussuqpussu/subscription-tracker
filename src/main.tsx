import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './styles/tokens.css'
import './styles/base.css'
import './styles/glass.css'
import App from './App'

// Service worker кэширует приложение: после установки на экран «Домой» оно открывается без сети.
registerSW({ immediate: true })

// Просим браузер не вытеснять localStorage при нехватке места. Отказ не критичен.
navigator.storage?.persist?.().catch(() => undefined)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
