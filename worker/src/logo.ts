/**
 * Поиск самой чёткой иконки сайта: SVG, apple-touch-icon, иконки из web manifest.
 * Чистые функции без HTMLRewriter и сети — их проверяют unit-тесты.
 */

export interface IconCandidate {
  url: string
  /** Сторона в пикселях; для SVG — условно самая большая. */
  size: number
}

/** SVG рисуется чётко в любом размере. */
export const SVG_SIZE = 4096
/** Иконки мельче не лучше значка из Google: их не отдаём. */
export const MIN_ICON_SIZE = 64
export const MAX_ICON_BYTES = 1024 * 1024

const HOST_RE = /^(?=.{4,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

/** Только обычные домены в нижнем регистре (punycode). IP-адреса и localhost не пропускаем. */
export function isValidHost(value: string | null): value is string {
  if (!value || !HOST_RE.test(value)) return false
  const tld = value.slice(value.lastIndexOf('.') + 1)
  return !/^\d+$/.test(tld)
}

/** «180x180», «16x16 32x32», «any» → наибольшая сторона; «any» — это SVG. */
export function parseSizes(sizes: string | null | undefined): number | null {
  if (!sizes) return null
  let best: number | null = null
  for (const token of sizes.trim().toLowerCase().split(/\s+/)) {
    if (token === 'any') return SVG_SIZE
    const match = /^(\d+)x(\d+)$/.exec(token)
    if (match) best = Math.max(best ?? 0, Math.min(Number(match[1]), Number(match[2])))
  }
  return best
}

function isSvg(url: string, type: string | null | undefined): boolean {
  return type === 'image/svg+xml' || /\.svg(?:$|[?#])/i.test(url)
}

function resolve(href: string, base: string): string | null {
  try {
    const url = new URL(href, base)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

export interface LinkTag {
  rel: string
  href: string
  sizes?: string | null
  type?: string | null
}

/** Иконки из <link> страницы. Размер без атрибута sizes берётся из обычаев: apple-touch-icon — 180. */
export function iconsFromLinks(links: readonly LinkTag[], pageUrl: string): IconCandidate[] {
  const icons: IconCandidate[] = []
  for (const link of links) {
    const rel = link.rel.toLowerCase().split(/\s+/)
    const apple = rel.includes('apple-touch-icon') || rel.includes('apple-touch-icon-precomposed')
    if (!apple && !rel.includes('icon')) continue
    const url = resolve(link.href, pageUrl)
    if (!url) continue
    const size = isSvg(url, link.type) ? SVG_SIZE : (parseSizes(link.sizes) ?? (apple ? 180 : 32))
    icons.push({ url, size })
  }
  return icons
}

/** Иконки из web manifest; монохромные (purpose: monochrome) пропускаем — они одноцветные силуэты. */
export function iconsFromManifest(manifest: unknown, manifestUrl: string): IconCandidate[] {
  if (typeof manifest !== 'object' || manifest === null || !Array.isArray((manifest as { icons?: unknown }).icons)) {
    return []
  }
  const icons: IconCandidate[] = []
  for (const item of (manifest as { icons: unknown[] }).icons) {
    if (typeof item !== 'object' || item === null) continue
    const { src, sizes, type, purpose } = item as Record<string, unknown>
    if (typeof src !== 'string') continue
    if (typeof purpose === 'string' && purpose.split(/\s+/).every((value) => value === 'monochrome')) continue
    const url = resolve(src, manifestUrl)
    if (!url) continue
    const size = isSvg(url, typeof type === 'string' ? type : null)
      ? SVG_SIZE
      : (parseSizes(typeof sizes === 'string' ? sizes : null) ?? 0)
    icons.push({ url, size })
  }
  return icons
}

/** От лучшей к худшей, без повторов и без слишком мелких. */
export function rankIcons(candidates: readonly IconCandidate[]): IconCandidate[] {
  const bySize = new Map<string, number>()
  for (const { url, size } of candidates) bySize.set(url, Math.max(bySize.get(url) ?? 0, size))
  return [...bySize]
    .map(([url, size]) => ({ url, size }))
    .filter((icon) => icon.size >= MIN_ICON_SIZE)
    .sort((a, b) => b.size - a.size)
}

/** Иконка чётче этого размера не расплывается в плитке 44 pt на экране Retina. */
export const MIN_CRISP_SIZE = 96

/**
 * Настоящий размер картинки по её заголовку: PNG, GIF, JPEG, WebP, ICO (наибольшая иконка внутри).
 * Сайты часто указывают в разметке размер больше настоящего. null — формат не распознан.
 */
export function imageSize(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const ascii = (offset: number, length: number) =>
    offset + length <= bytes.length ? String.fromCharCode(...bytes.subarray(offset, offset + length)) : ''
  const side = (width: number, height: number) => Math.min(width, height)

  // PNG: ширина и высота в IHDR.
  if (bytes.length >= 24 && ascii(1, 3) === 'PNG') return side(view.getUint32(16), view.getUint32(20))

  // GIF: логический экран, little-endian.
  if (bytes.length >= 10 && ascii(0, 3) === 'GIF') return side(view.getUint16(6, true), view.getUint16(8, true))

  // ICO: каталог иконок, 0 означает 256.
  if (bytes.length >= 6 && view.getUint16(0, true) === 0 && view.getUint16(2, true) === 1) {
    const count = view.getUint16(4, true)
    let best = 0
    for (let i = 0; i < count && 6 + i * 16 + 2 <= bytes.length; i += 1) {
      const width = bytes[6 + i * 16] || 256
      const height = bytes[7 + i * 16] || 256
      best = Math.max(best, side(width, height))
    }
    return best || null
  }

  // WebP: VP8 (lossy), VP8L (lossless), VP8X (extended).
  if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const chunk = ascii(12, 4)
    if (chunk === 'VP8 ') return side(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff)
    if (chunk === 'VP8L') {
      const bits = view.getUint32(21, true)
      return side((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1)
    }
    if (chunk === 'VP8X') {
      const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16))
      const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16))
      return side(width, height)
    }
    return null
  }

  // JPEG: ищем маркер начала кадра (SOF0–SOF15, кроме DHT, JPG и DAC).
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) return null
      const marker = bytes[offset + 1]
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return side(view.getUint16(offset + 7), view.getUint16(offset + 5))
      }
      offset += 2 + view.getUint16(offset + 2)
    }
  }
  return null
}

/** «plus.yandex.ru» → «yandex.ru», «www.netflix.com» → «netflix.com». У домена второго уровня родителя нет. */
export function parentHost(host: string): string | null {
  const labels = host.split('.')
  return labels.length > 2 ? labels.slice(1).join('.') : null
}
