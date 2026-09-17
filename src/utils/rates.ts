/**
 * Курсы валют ЦБ РФ для сводки трат в рублях.
 * Источник — зеркало ЦБ cbr-xml-daily.ru: официальный сайт ЦБ не отдаёт заголовки CORS.
 */
import type { Currency, Subscription } from '../types'
import { getMonthlyEquivalent, isActive } from './subscriptionUtils'

export const RATES_URL = 'https://www.cbr-xml-daily.ru/daily_json.js'
/** Курс ЦБ меняется раз в рабочий день; чаще двух раз в сутки не спрашиваем. */
export const RATES_MAX_AGE_MS = 12 * 60 * 60 * 1000

export interface Rates {
  /** Дата курса ЦБ, YYYY-MM-DD. */
  date: string
  /** Когда курс получен, unix-время в мс. */
  fetchedAt: number
  /** Сколько рублей стоит одна единица валюты. */
  rub: Record<Exclude<Currency, 'RUB'>, number>
}

const FOREIGN: readonly Exclude<Currency, 'RUB'>[] = ['USD', 'EUR', 'KZT']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isPositive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0

/** Ответ cbr-xml-daily.ru → курсы. Номинал учитывается: тенге котируется за 100 единиц. */
export function parseCbrRates(json: unknown, fetchedAt: number): Rates | null {
  if (!isRecord(json) || typeof json.Date !== 'string' || !isRecord(json.Valute)) return null
  const rub = {} as Rates['rub']
  for (const code of FOREIGN) {
    const entry = json.Valute[code]
    if (!isRecord(entry) || !isPositive(entry.Value) || !isPositive(entry.Nominal)) return null
    rub[code] = entry.Value / entry.Nominal
  }
  return { date: json.Date.slice(0, 10), fetchedAt, rub }
}

/** Проверка курсов из localStorage. */
export function normalizeRates(value: unknown): Rates | null {
  if (!isRecord(value) || typeof value.date !== 'string' || !isPositive(value.fetchedAt) || !isRecord(value.rub)) {
    return null
  }
  const rub = {} as Rates['rub']
  for (const code of FOREIGN) {
    const rate = value.rub[code]
    if (!isPositive(rate)) return null
    rub[code] = rate
  }
  return { date: value.date, fetchedAt: value.fetchedAt, rub }
}

export interface RubTotal {
  /** Траты в месяц в рублях. Без курса — только рублёвые подписки. */
  amount: number
  /** Есть активные подписки в других валютах. */
  converted: boolean
  /** Валюты, которые не удалось пересчитать: курса ещё нет. */
  missing: Exclude<Currency, 'RUB'>[]
}

/** Сумма в рублях. null — валюта не рублёвая, а курса ещё нет. */
export function convertToRub(amount: number, currency: Currency, rates: Rates | null): number | null {
  if (currency === 'RUB') return amount
  return rates ? amount * rates.rub[currency] : null
}

export function getMonthlyTotalRub(subscriptions: readonly Subscription[], rates: Rates | null): RubTotal {
  let amount = 0
  let converted = false
  const missing = new Set<Exclude<Currency, 'RUB'>>()
  for (const item of subscriptions) {
    if (!isActive(item)) continue
    const monthly = getMonthlyEquivalent(item)
    if (item.currency === 'RUB') {
      amount += monthly
      continue
    }
    converted = true
    if (rates) amount += monthly * rates.rub[item.currency]
    else missing.add(item.currency)
  }
  return { amount, converted, missing: FOREIGN.filter((code) => missing.has(code)) }
}
