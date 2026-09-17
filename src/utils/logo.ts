/** Ссылки на сайт подписки и логотипы: чистые функции без DOM. */

export const MAX_URL_LENGTH = 2048
/** Сторона квадрата, до которого уменьшается свой логотип. */
export const LOGO_SIZE = 128
/** ~110 КБ картинки: сотня логотипов помещается в localStorage с запасом. */
export const MAX_LOGO_LENGTH = 150_000

const SCHEME_RE = /^[a-z][a-z\d+.-]*:\/\//i
const LOGO_RE = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/

/**
 * «kinopoisk.ru», «www.kinopoisk.ru/subscriptions», «https://…» → полный адрес.
 * Всё, что не похоже на ссылку на сайт в интернете, → null.
 */
export function normalizeUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_URL_LENGTH || /\s/.test(trimmed)) return null
  let url: URL
  try {
    url = new URL(SCHEME_RE.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  // Нужен домен с точкой: «kinopoisk» без зоны — скорее опечатка.
  const labels = url.hostname.split('.')
  if (labels.length < 2 || labels.some((label) => label === '')) return null
  return url.href
}

/** Хост без «www.» — подпись ссылки в форме. */
export function getDisplayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function isValidLogo(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_LOGO_LENGTH && LOGO_RE.test(value)
}

/** Логотип мельче этого расплывается в плитке 44 pt на экране Retina: вместо него показываем букву. */
export const MIN_LOGO_SIZE = 96

export interface LogoSource {
  src: string
  /** Минимальная ширина загруженной картинки; 0 — картинка уже проверена сервером. */
  minWidth: number
}

/**
 * Откуда брать логотип сайта. Сервер приложения сам ищет чёткую иконку (SVG или от 96 px) на сайте,
 * на основном домене и у Google. Без сервера — значок Google, если он достаточно крупный.
 */
export function getSiteLogoSources(url: string, apiUrl: string): LogoSource[] {
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return []
  }
  const encoded = encodeURIComponent(host)
  // v=3 — сбрасывает кэш браузера: раньше сервер мог отдать мелкую иконку.
  if (apiUrl) return [{ src: `${apiUrl}/api/logo?host=${encoded}&v=3`, minWidth: 0 }]
  return [{ src: `https://www.google.com/s2/favicons?sz=128&domain=${encoded}`, minWidth: MIN_LOGO_SIZE }]
}
