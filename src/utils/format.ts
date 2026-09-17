import { BILLING_PERIOD_LABELS, STATUS_LABELS } from '../constants'
import type { Currency, Subscription } from '../types'
import { normalizeCustomDays } from './dateUtils'

const LOCALE = 'ru-RU'

const moneyFormatters = new Map<string, Intl.NumberFormat>()

function getMoneyFormatter(currency: Currency, fractionDigits: number): Intl.NumberFormat {
  const key = `${currency}:${fractionDigits}`
  let formatter = moneyFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      // Без narrowSymbol ru-RU пишет «KZT» вместо «₸».
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
    moneyFormatters.set(key, formatter)
  }
  return formatter
}

/** Целые суммы без копеек, дробные — ровно с двумя знаками. */
export function formatMoney(amount: number, currency: Currency): string {
  const cents = Math.round(amount * 100)
  return getMoneyFormatter(currency, cents % 100 === 0 ? 0 : 2).format(cents / 100)
}

const dayMonthFormatter = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long' })
const fullDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** «17 сентября»; год добавляется, только если он не текущий. */
export function formatDate(date: Date, today: Date = new Date()): string {
  return date.getFullYear() === today.getFullYear()
    ? dayMonthFormatter.format(date)
    : fullDateFormatter.format(date)
}

/** Первая буква названия для плитки-аватара. Array.from не разрезает эмодзи пополам. */
export function getInitial(text: string): string {
  return (Array.from(text.trim())[0] ?? '').toLocaleUpperCase('ru')
}

const pluralRules = new Intl.PluralRules(LOCALE)

/** Форма слова по числу: pluralize(5, ['подписка', 'подписки', 'подписок']) → «подписок». */
export function pluralize(count: number, [one, few, many]: readonly [string, string, string]): string {
  if (!Number.isInteger(count)) return few
  const rule = pluralRules.select(count)
  if (rule === 'one') return one
  if (rule === 'few') return few
  return many
}

/** «3 платежа», «5 платежей». */
export function formatPaymentCount(count: number): string {
  return `${count} ${pluralize(count, ['платёж', 'платежа', 'платежей'])}`
}

export function formatSubscriptionCount(count: number): string {
  return `${count} ${pluralize(count, ['подписка', 'подписки', 'подписок'])}`
}

/** «1 день», «3 дня», «5 дней». */
export function formatDays(count: number): string {
  return `${count} ${pluralize(count, ['день', 'дня', 'дней'])}`
}

/** Текст срока рядом с лампочкой. */
export function formatDueText(daysLeft: number): string {
  if (daysLeft < 0) return `просрочено на ${formatDays(-daysLeft)}`
  if (daysLeft === 0) return 'сегодня'
  if (daysLeft === 1) return 'завтра'
  return `через ${formatDays(daysLeft)}`
}

export function formatStatus(subscription: Pick<Subscription, 'status'>): string {
  return STATUS_LABELS[subscription.status].toLowerCase()
}

export function formatPeriod(subscription: Pick<Subscription, 'billingPeriod' | 'customDays'>): string {
  if (subscription.billingPeriod === 'custom') {
    const days = normalizeCustomDays(subscription.customDays)
    return `${pluralRules.select(days) === 'one' ? 'Каждый' : 'Каждые'} ${formatDays(days)}`
  }
  return BILLING_PERIOD_LABELS[subscription.billingPeriod]
}

/** «1, 3 и 7 дней» для списка напоминаний. */
export function formatReminderList(days: readonly number[]): string {
  if (days.length === 0) return ''
  const sorted = [...days].sort((a, b) => a - b)
  const last = sorted[sorted.length - 1]
  if (sorted.length === 1) return formatDays(last)
  return `${sorted.slice(0, -1).join(', ')} и ${formatDays(last)}`
}
