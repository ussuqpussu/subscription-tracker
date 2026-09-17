import {
  BILLING_PERIODS,
  CURRENCIES,
  MAX_CUSTOM_DAYS,
  MAX_REMINDER_DAYS,
  STATUSES,
} from '../constants'
import type { BillingPeriod, Currency, Payment, PriceChange, Status, Subscription } from '../types'
import { isValidISODate } from './dateUtils'
import { isValidLogo, normalizeUrl } from './logo'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value)
}

export function isValidReminder(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_REMINDER_DAYS
}

export function isValidCustomDays(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_CUSTOM_DAYS
}

/** Записи истории: дата, сумма и валюта. Испорченные строки отбрасываются. */
function normalizeMoneyLog<T extends { date: string; currency: Currency }>(
  value: unknown,
  amountKey: 'amount' | 'price',
): T[] {
  if (!Array.isArray(value)) return []
  const items: T[] = []
  for (const entry of value) {
    if (!isRecord(entry) || !isValidISODate(entry.date) || !isOneOf<Currency>(CURRENCIES, entry.currency)) continue
    const amount = entry[amountKey]
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) continue
    items.push({ date: entry.date, currency: entry.currency, [amountKey]: amount } as T)
  }
  return items
}

/** Уникальные напоминания по возрастанию. */
export function normalizeReminders(values: readonly number[]): number[] {
  return [...new Set(values.filter(isValidReminder))].sort((a, b) => a - b)
}

/**
 * Проверяет запись из localStorage или резервной копии.
 * Возвращает чистый объект только с известными полями или `null`, если запись испорчена.
 */
export function normalizeSubscription(value: unknown): Subscription | null {
  if (!isRecord(value)) return null

  const {
    id,
    name,
    price,
    currency,
    startDate,
    billingPeriod,
    customDays,
    category,
    status,
    notes,
    url,
    logo,
    trialUntil,
    payments,
    priceHistory,
    reminders,
    paidThrough,
  } = value

  if (typeof id !== 'string' || id.trim() === '') return null
  if (typeof name !== 'string' || name.trim() === '') return null
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return null
  if (!isOneOf<Currency>(CURRENCIES, currency)) return null
  if (!isValidISODate(startDate)) return null
  if (!isOneOf<BillingPeriod>(BILLING_PERIODS, billingPeriod)) return null
  if (billingPeriod === 'custom' && !isValidCustomDays(customDays)) return null
  if (!isOneOf<Status>(STATUSES, status)) return null

  const subscription: Subscription = {
    id,
    name: name.trim(),
    price,
    currency,
    startDate,
    billingPeriod,
    category: typeof category === 'string' ? category.trim() : '',
    status,
    reminders: Array.isArray(reminders) ? normalizeReminders(reminders as number[]) : [],
  }
  if (billingPeriod === 'custom') subscription.customDays = customDays as number
  if (typeof notes === 'string' && notes.trim() !== '') subscription.notes = notes
  const normalizedUrl = typeof url === 'string' ? normalizeUrl(url) : null
  if (normalizedUrl) subscription.url = normalizedUrl
  if (isValidLogo(logo)) subscription.logo = logo
  if (isValidISODate(trialUntil)) subscription.trialUntil = trialUntil
  const validPayments = normalizeMoneyLog<Payment>(payments, 'amount')
  if (validPayments.length > 0) subscription.payments = validPayments
  const validPrices = normalizeMoneyLog<PriceChange>(priceHistory, 'price')
  if (validPrices.length > 0) subscription.priceHistory = validPrices
  if (isValidISODate(paidThrough)) subscription.paidThrough = paidThrough
  return subscription
}

/** Отбрасывает испорченные записи и повторяющиеся id. */
export function normalizeSubscriptions(value: unknown): { items: Subscription[]; skipped: number } {
  if (!Array.isArray(value)) return { items: [], skipped: 0 }
  const items: Subscription[] = []
  const seenIds = new Set<string>()
  let skipped = 0
  for (const entry of value) {
    const subscription = normalizeSubscription(entry)
    if (!subscription || seenIds.has(subscription.id)) {
      skipped += 1
      continue
    }
    seenIds.add(subscription.id)
    items.push(subscription)
  }
  return { items, skipped }
}
