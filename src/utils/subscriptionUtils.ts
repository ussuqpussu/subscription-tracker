import { CURRENCIES, SOON_THRESHOLD_DAYS } from '../constants'
import type { Currency, Lamp, Status, Subscription } from '../types'
import {
  compareDates,
  getDaysUntil,
  getDueDate,
  getLastPaymentBefore,
  getPaymentDate,
  getPaymentIndexOnOrAfter,
  makeDate,
  normalizeCustomDays,
  toISODate,
} from './dateUtils'

/** Дней до неоплаченного платежа. Отрицательное число — просрочка. */
export function getDaysLeft(subscription: Subscription, today: Date): number {
  return getDaysUntil(getDueDate(subscription), today)
}

export function getLamp(subscription: Subscription, today: Date): Lamp {
  if (subscription.status !== 'active') return 'off'
  const daysLeft = getDaysLeft(subscription, today)
  if (daysLeft < 0) return 'red'
  if (daysLeft <= SOON_THRESHOLD_DAYS) return 'yellow'
  return 'green'
}

/** Прошлые платежи считаются оплаченными: срок совпадает с ближайшим платежом. */
export function withInitialPaidThrough(subscription: Subscription, today: Date): Subscription {
  const lastPayment = getLastPaymentBefore(subscription, today)
  const next: Subscription = { ...subscription }
  if (lastPayment) next.paidThrough = toISODate(lastPayment)
  else delete next.paidThrough
  return next
}

/**
 * Сохраняет отметки об оплате при редактировании.
 * Если поменялось расписание или подписку возобновили, прошлое снова считается оплаченным.
 */
export function mergeEdit(previous: Subscription, edited: Subscription, today: Date): Subscription {
  const scheduleChanged =
    previous.startDate !== edited.startDate ||
    previous.billingPeriod !== edited.billingPeriod ||
    (edited.billingPeriod === 'custom' && previous.customDays !== edited.customDays)
  const reactivated = previous.status !== 'active' && edited.status === 'active'
  if (scheduleChanged || reactivated) return withInitialPaidThrough(edited, today)

  const next: Subscription = { ...edited }
  if (previous.paidThrough) next.paidThrough = previous.paidThrough
  else delete next.paidThrough
  return next
}

/** Одна отметка = один оплаченный платёж. */
export function markPaid(subscription: Subscription): Subscription {
  return { ...subscription, paidThrough: toISODate(getDueDate(subscription)) }
}

export function isActive(subscription: Subscription): boolean {
  return subscription.status === 'active'
}

const nameCollator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true })

/** Активные — по дням до платежа (просроченные первыми), неактивные — в конце по названию. */
export function sortSubscriptions(subscriptions: readonly Subscription[], today: Date): Subscription[] {
  const daysById = new Map(subscriptions.map((item) => [item.id, getDaysLeft(item, today)]))
  return [...subscriptions].sort((a, b) => {
    const activeDiff = Number(isActive(b)) - Number(isActive(a))
    if (activeDiff !== 0) return activeDiff
    if (isActive(a)) {
      const daysDiff = (daysById.get(a.id) ?? 0) - (daysById.get(b.id) ?? 0)
      if (daysDiff !== 0) return daysDiff
    }
    return nameCollator.compare(a.name, b.name)
  })
}

/** Категории из введённых подписок: без пустых и повторов (регистр не важен), по алфавиту. */
export function collectCategories(subscriptions: readonly Subscription[]): string[] {
  const byKey = new Map<string, string>()
  for (const { category } of subscriptions) {
    const trimmed = category.trim()
    const key = trimmed.toLocaleLowerCase('ru')
    if (trimmed && !byKey.has(key)) byKey.set(key, trimmed)
  }
  return [...byKey.values()].sort(nameCollator.compare)
}

export type StatusFilter = Status | 'all'

export interface Filters {
  status: StatusFilter
  category: string | null
}

export function filterSubscriptions(
  subscriptions: readonly Subscription[],
  filters: Filters,
): Subscription[] {
  const categoryKey = filters.category?.trim().toLocaleLowerCase('ru')
  return subscriptions.filter(
    (item) =>
      (filters.status === 'all' || item.status === filters.status) &&
      (!categoryKey || item.category.trim().toLocaleLowerCase('ru') === categoryKey),
  )
}

const AVERAGE_DAYS_IN_MONTH = 365.25 / 12

/** Сколько подписка стоит в пересчёте на один месяц. */
export function getMonthlyEquivalent(subscription: Subscription): number {
  switch (subscription.billingPeriod) {
    case 'weekly':
      return (subscription.price * 52) / 12
    case 'monthly':
      return subscription.price
    case 'quarterly':
      return subscription.price / 3
    case 'biannual':
      return subscription.price / 6
    case 'yearly':
      return subscription.price / 12
    case 'custom':
      return (subscription.price * AVERAGE_DAYS_IN_MONTH) / normalizeCustomDays(subscription.customDays)
  }
}

export interface CurrencyTotal {
  currency: Currency
  amount: number
}

/** Траты в месяц по активным подпискам, отдельно по каждой валюте. */
export function getMonthlyTotals(subscriptions: readonly Subscription[]): CurrencyTotal[] {
  const totals = new Map<Currency, number>()
  for (const item of subscriptions) {
    if (!isActive(item)) continue
    totals.set(item.currency, (totals.get(item.currency) ?? 0) + getMonthlyEquivalent(item))
  }
  return CURRENCIES.filter((currency) => totals.has(currency)).map((currency) => ({
    currency,
    amount: totals.get(currency) ?? 0,
  }))
}

export function countOverdue(subscriptions: readonly Subscription[], today: Date): number {
  return subscriptions.filter((item) => getLamp(item, today) === 'red').length
}

export interface MonthForecast {
  /** Первое число месяца. */
  month: Date
  amount: number
}

/**
 * Сумма платежей по расписанию в каждом месяце, начиная с текущего.
 * Учитываются активные подписки в одной валюте; оплаченные платежи текущего месяца тоже входят в сумму.
 */
export function getPaymentForecast(
  subscriptions: readonly Subscription[],
  currency: Currency,
  today: Date,
  months = 6,
): MonthForecast[] {
  const items = subscriptions.filter((item) => isActive(item) && item.currency === currency)
  return Array.from({ length: months }, (_, offset) => {
    const month = makeDate(today.getFullYear(), today.getMonth() + offset, 1)
    const nextMonth = makeDate(today.getFullYear(), today.getMonth() + offset + 1, 1)
    let amount = 0
    for (const item of items) {
      let index = getPaymentIndexOnOrAfter(item, month)
      while (compareDates(getPaymentDate(item, index), nextMonth) < 0) {
        amount += item.price
        index += 1
      }
    }
    return { month, amount }
  })
}
