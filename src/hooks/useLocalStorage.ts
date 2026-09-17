import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { readJSON, writeJSON } from '../utils/storage'

/**
 * Состояние, которое читается из localStorage при старте и записывается при каждом изменении.
 * `parse` проверяет сохранённые данные: испорченное хранилище не должно ронять приложение.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  parse: (raw: unknown) => T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const raw = readJSON(key)
    return raw === undefined ? initialValue : parse(raw)
  })

  useEffect(() => {
    writeJSON(key, value)
  }, [key, value])

  return [value, setValue]
}
