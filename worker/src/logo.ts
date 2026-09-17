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
