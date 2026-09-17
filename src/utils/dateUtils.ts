import { MAX_CUSTOM_DAYS, MAX_YEAR, MIN_YEAR } from '../constants'
import type { BillingPeriod, Schedule, Subscription } from '../types'

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000
const DEFAULT_CUSTOM_DAYS = 30

const MONTHS_PER_PERIOD: Partial<Record<BillingPeriod, number>> = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  yearly: 12,
}

/**
 * Локальная полночь для года, месяца (0–11) и дня.
 * setFullYear сам переносит переполнение месяца и дня и не превращает годы < 100 в 19xx.
 */
export function makeDate(year: number, monthIndex: number, day: number): Date {
  const date = new Date(2000, 0, 1)
  date.setFullYear(year, monthIndex, day)
  date.setHours(0, 0, 0, 0)
  return date
}

export function daysInMonth(year: number, monthIndex: number): number {
  return makeDate(year, monthIndex + 1, 0).getDate()
}

export function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = ISO_DATE_RE.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < MIN_YEAR || year > MAX_YEAR) return false
  if (month < 1 || month > 12 || day < 1) return false
  return day <= daysInMonth(year, month - 1)
}

/** Разбирает `YYYY-MM-DD` в локальную полночь. `new Date('YYYY-MM-DD')` дал бы UTC и сдвиг дня. */
export function parseISODate(value: string): Date {
  const match = ISO_DATE_RE.exec(value)
  if (!match) throw new RangeError(`Некорректная дата: ${value}`)
  return makeDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export function toISODate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function startOfDay(date: Date): Date {
  return makeDate(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
  return makeDate(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** Прибавляет месяцы; если в целевом месяце нет такого дня, берёт последний день месяца. */
export function addMonthsClamped(date: Date, months: number): Date {
  const result = makeDate(date.getFullYear(), date.getMonth() + months, 1)
  result.setDate(Math.min(date.getDate(), daysInMonth(result.getFullYear(), result.getMonth())))
  return result
}

/** Сравнивает только календарные даты: < 0, 0 или > 0. */
export function compareDates(a: Date, b: Date): number {
  return (
    (a.getFullYear() - b.getFullYear()) * 10_000 +
    (a.getMonth() - b.getMonth()) * 100 +
    (a.getDate() - b.getDate())
  )
}

/** Целое число дней от `today` до `date`. Отрицательное — дата в прошлом. */
export function getDaysUntil(date: Date | string, today: Date = new Date()): number {
  const target = typeof date === 'string' ? parseISODate(date) : date
  const from = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const to = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.round((to - from) / MS_PER_DAY)
}

export function normalizeCustomDays(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_CUSTOM_DAYS) {
    return DEFAULT_CUSTOM_DAYS
  }
  return value
}

/** Сколько месяцев в периоде; для weekly и custom — undefined. */
export function getMonthsPerPeriod(period: BillingPeriod): number | undefined {
  return MONTHS_PER_PERIOD[period]
}

function getDaysPerPeriod(schedule: Schedule): number {
  return schedule.billingPeriod === 'weekly' ? 7 : normalizeCustomDays(schedule.customDays)
}

/**
 * Платёж номер `index` (0 — первый) по расписанию.
 * Месяцы и годы считаются от исходной даты, поэтому 31-е число не «уползает» после короткого месяца.
 */
export function getPaymentDate(schedule: Schedule, index: number): Date {
  const start = parseISODate(schedule.startDate)
  const months = getMonthsPerPeriod(schedule.billingPeriod)
  if (months !== undefined) return addMonthsClamped(start, months * index)
  return addDays(start, getDaysPerPeriod(schedule) * index)
}

/** Номер первого платежа, который приходится на `date` или позже. */
export function getPaymentIndexOnOrAfter(schedule: Schedule, date: Date): number {
  const start = parseISODate(schedule.startDate)
  if (compareDates(start, date) >= 0) return 0

  // Оценка снизу: платёж с этим номером гарантированно раньше `date`.
  const months = getMonthsPerPeriod(schedule.billingPeriod)
  let index: number
  if (months !== undefined) {
    const monthDiff =
      (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth())
    index = Math.max(0, Math.floor(monthDiff / months) - 1)
  } else {
    index = Math.max(0, Math.floor(getDaysUntil(date, start) / getDaysPerPeriod(schedule)) - 1)
  }

  while (compareDates(getPaymentDate(schedule, index), date) < 0) index += 1
  return index
}

/** Ближайший платёж: от startDate прибавляется период, пока дата не станет сегодняшней или будущей. */
export function getNextPaymentDate(schedule: Schedule, today: Date = new Date()): Date {
  return getPaymentDate(schedule, getPaymentIndexOnOrAfter(schedule, today))
}

/** Последний платёж строго раньше `date` или `null`, если таких нет. */
export function getLastPaymentBefore(schedule: Schedule, date: Date): Date | null {
  const index = getPaymentIndexOnOrAfter(schedule, date)
  return index === 0 ? null : getPaymentDate(schedule, index - 1)
}

/** Платёж, который ещё не отмечен оплаченным. Может быть в прошлом — тогда подписка просрочена. */
export function getDueDate(subscription: Schedule & Pick<Subscription, 'paidThrough'>): Date {
  if (!subscription.paidThrough || !isValidISODate(subscription.paidThrough)) {
    return parseISODate(subscription.startDate)
  }
  const dayAfterPaid = addDays(parseISODate(subscription.paidThrough), 1)
  return getPaymentDate(subscription, getPaymentIndexOnOrAfter(subscription, dayAfterPaid))
}
