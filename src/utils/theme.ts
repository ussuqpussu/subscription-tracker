import { ACCENTS, DEFAULT_ACCENT, type AccentId, type ThemeMode } from '../constants'

/**
 * Тема и акцентная палитра. Тема ставится атрибутом data-theme на <html>, палитра —
 * атрибутом data-accent; значения разбирает tokens.css. В режиме «Авто» атрибута нет,
 * и цвета выбирает системный prefers-color-scheme.
 */

/** Цвет строки состояния: совпадает с фоном страницы, см. --bg в tokens.css. */
const THEME_COLORS: Record<'light' | 'dark', string> = {
  light: '#f2f2f7',
  dark: '#000000',
}

export const parseThemeMode = (raw: unknown): ThemeMode => (raw === 'light' || raw === 'dark' ? raw : 'auto')

export const parseAccentId = (raw: unknown): AccentId =>
  ACCENTS.some((palette) => palette.id === raw) ? (raw as AccentId) : DEFAULT_ACCENT

/** Системная тема. Медиазапроса может не быть в старых webview — тогда считаем тему тёмной. */
const prefersLight = () => window.matchMedia?.('(prefers-color-scheme: light)').matches === true

/** Какая тема действует сейчас: «Авто» спрашивает систему. */
export const resolveTheme = (mode: ThemeMode): 'light' | 'dark' =>
  mode === 'auto' ? (prefersLight() ? 'light' : 'dark') : mode

const setMeta = (name: string, content: string) => {
  document.querySelector(`meta[name="${name}"]`)?.setAttribute('content', content)
}

/**
 * Применяет тему к документу. Вместе с атрибутом синхронно меняется theme-color:
 * в установленном приложении им закрашена строка состояния, и она не должна отставать.
 */
export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement
  if (mode === 'auto') delete root.dataset.theme
  else root.dataset.theme = mode
  setMeta('theme-color', THEME_COLORS[resolveTheme(mode)])
  setMeta('color-scheme', mode === 'auto' ? 'light dark' : mode)
}

export function applyAccent(accent: AccentId): void {
  document.documentElement.dataset.accent = accent
}

/** Пока выбрано «Авто», следим за системной темой: theme-color меняем вместе с ней. */
export function watchSystemTheme(onChange: () => void): () => void {
  const query = window.matchMedia?.('(prefers-color-scheme: light)')
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}
