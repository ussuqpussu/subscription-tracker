import { SOON_THRESHOLD_DAYS } from '../constants'
import type { Lamp, Payment, PriceChange, Status, Subscription } from '../types'
import {
  getDaysUntil,
  getDueDate,
  getLastPaymentBefore,
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

/** Подписка после правки: история платежей и прошлые цены остаются, смена цены записывается. */
export function keepHistory(previous: Subscription, edited: Subscription, today: Date): Subscription {
  const next: Subscription = { ...edited }
  if (previous.payments?.length) next.payments = previous.payments
  const priceChanged = previous.price !== edited.price || previous.currency !== edited.currency
  const history: PriceChange[] = [...(previous.priceHistory ?? [])]
  if (priceChanged) {
    history.push({ date: toISODate(today), price: previous.price, currency: previous.currency })
  }
  if (history.length > 0) next.priceHistory = history.slice(-MAX_PRICE_CHANGES)
  return next
}

/** Столько записей истории храним: дальше localStorage растёт без пользы. */
export const MAX_PAYMENTS = 120
export const MAX_PRICE_CHANGES = 20

/** Одна отметка = один оплаченный платёж. Дата и сумма попадают в историю. */
export function markPaid(subscription: Subscription): Subscription {
  const dueDate = getDueDate(subscription)
  const payment: Payment = {
    date: toISODate(dueDate),
    amount: subscription.price,
    currency: subscription.currency,
  }
  const payments = [...(subscription.payments ?? []), payment].slice(-MAX_PAYMENTS)
  return { ...subscription, paidThrough: payment.date, payments }
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
  /** Поиск по названию, категории и заметкам. Пусто — без поиска. */
  query?: string
}

/** Поисковый запрос: без регистра и лишних пробелов. */
function matchesQuery(subscription: Subscription, query: string): boolean {
  const haystack = [subscription.name, subscription.category, subscription.notes ?? '']
    .join(' ')
    .toLocaleLowerCase('ru')
  return query.split(/s+/).every((word) => haystack.includes(word))
}

export function filterSubscriptions(
  subscriptions: readonly Subscription[],
  filters: Filters,
): Subscription[] {
  const categoryKey = filters.category?.trim().toLocaleLowerCase('ru')
  const query = filters.query?.trim().toLocaleLowerCase('ru') ?? ''
  return subscriptions.filter(
    (item) =>
      (filters.status === 'all' || item.status === filters.status) &&
      (!categoryKey || item.category.trim().toLocaleLowerCase('ru') === categoryKey) &&
      (!query || matchesQuery(item, query)),
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

export function countOverdue(subscriptions: readonly Subscription[], today: Date): number {
  return subscriptions.filter((item) => getLamp(item, today) === 'red').length
}
