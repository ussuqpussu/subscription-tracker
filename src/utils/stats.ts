/** Аналитика: доли категорий, фактические траты по истории платежей и подсказки. */
import type { Subscription } from '../types'
import { getDaysUntil, parseISODate } from './dateUtils'
import { formatDays, formatMoney } from './format'
import { convertToRub, type Rates } from './rates'
import { getLamp, getMonthlyEquivalent, isActive } from './subscriptionUtils'

export const NO_CATEGORY = 'Без категории'
/** Пробный период, который заканчивается в ближайшие столько дней, попадает в подсказки. */
export const TRIAL_SOON_DAYS = 7
export const MAX_TIPS = 4

export interface CategoryShare {
  category: string
  /** Траты в месяц в рублях. */
  amount: number
  /** Доля от всех трат, 0–1. */
  share: number
}

/** Траты в месяц по категориям активных подписок, от крупной к мелкой. */
export function getCategoryShares(subscriptions: readonly Subscription[], rates: Rates | null): CategoryShare[] {
  const byCategory = new Map<string, number>()
  let total = 0
  for (const item of subscriptions) {
    if (!isActive(item)) continue
    const amount = convertToRub(getMonthlyEquivalent(item), item.currency, rates)
    if (amount === null) continue
    const category = item.category.trim() || NO_CATEGORY
    byCategory.set(category, (byCategory.get(category) ?? 0) + amount)
    total += amount
  }
  return [...byCategory]
    .map(([category, amount]) => ({ category, amount, share: total > 0 ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount)
}

/** Сколько реально оплачено за период по истории отметок «Оплачено». */
export function getSpent(
  subscriptions: readonly Subscription[],
  rates: Rates | null,
  from: Date,
  to: Date,
): number {
  let total = 0
  for (const item of subscriptions) {
    for (const payment of item.payments ?? []) {
      const date = parseISODate(payment.date)
      if (date < from || date > to) continue
      total += convertToRub(payment.amount, payment.currency, rates) ?? 0
    }
  }
  return total
}

export interface Tip {
  id: string
  text: string
  tone: 'info' | 'warning'
}

/** Подсказки по текущему списку: просрочка, пробные периоды, крупные и лишние подписки. */
export function getTips(subscriptions: readonly Subscription[], today: Date, rates: Rates | null): Tip[] {
  const tips: Tip[] = []
  const active = subscriptions.filter(isActive)

  const overdue = subscriptions.filter((item) => getLamp(item, today) === 'red')
  if (overdue.length > 0) {
    const amount = overdue.reduce((sum, item) => sum + (convertToRub(item.price, item.currency, rates) ?? 0), 0)
    tips.push({
      id: 'overdue',
      tone: 'warning',
      text: `Просрочено платежей: ${overdue.length} на ${formatMoney(amount, 'RUB')}. Отметьте оплату или отмените подписку.`,
    })
  }

  for (const item of active) {
    if (!item.trialUntil) continue
    const daysLeft = getDaysUntil(item.trialUntil, today)
    if (daysLeft < 0 || daysLeft > TRIAL_SOON_DAYS) continue
    const when = daysLeft === 0 ? 'сегодня' : daysLeft === 1 ? 'завтра' : `через ${formatDays(daysLeft)}`
    tips.push({
      id: `trial:${item.id}`,
      tone: 'warning',
      text: `Пробный период «${item.name}» заканчивается ${when}: дальше спишется ${formatMoney(item.price, item.currency)}.`,
    })
  }

  const shares = getCategoryShares(subscriptions, rates)
  const [biggest] = shares
  if (biggest && shares.length > 1 && biggest.share >= 0.4) {
    tips.push({
      id: 'biggest-category',
      tone: 'info',
      text: `Категория «${biggest.category}» съедает ${Math.round(biggest.share * 100)}% трат — ${formatMoney(biggest.amount, 'RUB')} в месяц.`,
    })
  }

  const inactive = subscriptions.length - active.length
  if (inactive > 0) {
    tips.push({
      id: 'inactive',
      tone: 'info',
      text: `Не активны: ${inactive}. Удалите те, к которым не вернётесь: список станет короче.`,
    })
  }

  return tips.slice(0, MAX_TIPS)
}
