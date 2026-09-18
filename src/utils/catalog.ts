/**
 * Каталог готовых сервисов с сервера. Он длиннее встроенного списка, но без сети и без сервера
 * форма работает по-прежнему: подставляется SERVICE_PRESETS.
 */
import { API_URL } from '../config'
import { SERVICE_PRESETS, type ServicePreset } from '../constants'

/** Больше сервер не присылает: защита от неожиданно большого ответа. */
const MAX_CATALOG_SERVICES = 500

/** Каталог загружается один раз за запуск: форма открывается часто. */
let cached: readonly ServicePreset[] | null = null

function isFilled(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

/** Ответ сервера → список сервисов. Непохожий ответ и битые записи отбрасываются. */
export function parseCatalog(raw: unknown): ServicePreset[] | null {
  const services = (raw as { services?: unknown } | null)?.services
  if (!Array.isArray(services)) return null
  const result: ServicePreset[] = []
  for (const item of services.slice(0, MAX_CATALOG_SERVICES)) {
    const { name, url, category } = (item ?? {}) as Partial<ServicePreset>
    if (!isFilled(name) || !isFilled(url)) continue
    result.push({ name, url, category: isFilled(category) ? category : '' })
  }
  return result.length > 0 ? result : null
}

/**
 * Каталог с сервера или встроенный список. Ошибки сети молча приводят к встроенному:
 * готовые сервисы — удобство, а не обязательная часть формы.
 */
export async function loadCatalog(signal?: AbortSignal): Promise<readonly ServicePreset[]> {
  if (cached) return cached
  if (API_URL === '') return SERVICE_PRESETS
  try {
    const response = await fetch(`${API_URL}/api/catalog`, { signal })
    if (!response.ok) return SERVICE_PRESETS
    const parsed = parseCatalog(await response.json())
    if (!parsed) return SERVICE_PRESETS
    cached = parsed
    return parsed
  } catch {
    return SERVICE_PRESETS
  }
}
