import { useEffect } from 'react'
import { RATES_KEY } from '../constants'
import { normalizeRates, parseCbrRates, RATES_MAX_AGE_MS, RATES_URL, type Rates } from '../utils/rates'
import { useLocalStorage } from './useLocalStorage'

const parseStoredRates = (raw: unknown) => normalizeRates(raw)

/**
 * Курсы ЦБ с кэшем в localStorage: без сети сводка считается по последнему известному курсу.
 * Обновляются при запуске и когда приложение снова открыли после смены дня.
 */
export function useRates(needed: boolean, today: Date): Rates | null {
  const [rates, setRates] = useLocalStorage<Rates | null>(RATES_KEY, null, parseStoredRates)
  const fetchedAt = rates?.fetchedAt ?? 0

  useEffect(() => {
    if (!needed || Date.now() - fetchedAt < RATES_MAX_AGE_MS) return
    const controller = new AbortController()
    fetch(RATES_URL, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((json: unknown) => {
        const next = parseCbrRates(json, Date.now())
        if (next) setRates(next)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [needed, fetchedAt, today, setRates])

  return rates
}
