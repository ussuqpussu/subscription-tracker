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

/** Значок сайта из сервиса Google: 128 px, если сайт отдаёт такой размер. */
export function getSiteLogoUrl(url: string): string | null {
  try {
    return `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(new URL(url).hostname)}`
  } catch {
    return null
  }
}
