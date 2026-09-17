/**
 * Обёртки над localStorage. Любая ошибка (приватный режим, переполнение, запрет сайта)
 * гасится: приложение продолжает работать с данными в памяти.
 */

export function readJSON(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? undefined : (JSON.parse(raw) as unknown)
  } catch {
    return undefined
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Хранилище недоступно — удалять нечего.
  }
}
