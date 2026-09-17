/** События календаря: списания по расписанию и окончания пробных периодов. */
import type { Currency, Subscription } from '../types'
import {
  compareDates,
  getPaymentDate,
  getPaymentIndexOnOrAfter,
  makeDate,
  parseISODate,
  toISODate,
} from './dateUtils'
import { convertToRub, type Rates } from './rates'
import { isActive } from './subscriptionUtils'

export type CalendarEventType = 'payment' | 'trial'

export interface CalendarEvent {
  type: CalendarEventType
  subscription: Subscription
  /** Сумма списания; у конца пробного периода — будущая цена. */
  amount: number
  currency: Currency
}

/** События месяца по дням: ключ — ISO-дата. */
export type MonthEvents = Map<string, CalendarEvent[]>

/** Первое число месяца, в котором лежит дата. */
export function startOfMonth(date: Date): Date {
  return makeDate(date.getFullYear(), date.getMonth(), 1)
}

/** Сдвиг на несколько месяцев от первого числа. */
export function addMonths(month: Date, count: number): Date {
  return makeDate(month.getFullYear(), month.getMonth() + count, 1)
}

/**
 * Что спишется в этом месяце: платежи активных подписок по расписанию
 * и дни, когда заканчивается пробный период.
 */
export function getMonthEvents(subscriptions: readonly Subscription[], month: Date): MonthEvents {
  const first = startOfMonth(month)
  const next = addMonths(first, 1)
  const events: MonthEvents = new Map()

  const add = (date: Date, event: CalendarEvent) => {
    const key = toISODate(date)
    const list = events.get(key)
    if (list) list.push(event)
    else events.set(key, [event])
  }

  for (const subscription of subscriptions) {
    if (!isActive(subscription)) continue

    for (
      let index = getPaymentIndexOnOrAfter(subscription, first);
      compareDates(getPaymentDate(subscription, index), next) < 0;
      index += 1
    ) {
      add(getPaymentDate(subscription, index), {
        type: 'payment',
        subscription,
        amount: subscription.price,
        currency: subscription.currency,
      })
    }

    if (subscription.trialUntil) {
      const trialEnd = parseISODate(subscription.trialUntil)
      if (compareDates(trialEnd, first) >= 0 && compareDates(trialEnd, next) < 0) {
        add(trialEnd, {
          type: 'trial',
          subscription,
          amount: subscription.price,
          currency: subscription.currency,
        })
      }
    }
  }

  return events
}

export interface MonthTotal {
  /** Сколько спишется за месяц в рублях. */
  amount: number
  payments: number
}

/** Итог месяца по событиям: сумма списаний в рублях и их число. */
export function getMonthTotal(events: MonthEvents, rates: Rates | null): MonthTotal {
  let amount = 0
  let payments = 0
  for (const list of events.values()) {
    for (const event of list) {
      if (event.type !== 'payment') continue
      payments += 1
      amount += convertToRub(event.amount, event.currency, rates) ?? 0
    }
  }
  return { amount, payments }
}

/** Шесть недель сетки: дни с понедельника, включая хвосты соседних месяцев. */
export function getMonthGrid(month: Date): Date[] {
  const first = startOfMonth(month)
  // getDay(): 0 — воскресенье; в русской сетке неделя начинается с понедельника.
  const shift = (first.getDay() + 6) % 7
  const start = makeDate(first.getFullYear(), first.getMonth(), 1 - shift)
  return Array.from({ length: 42 }, (_, index) =>
    makeDate(start.getFullYear(), start.getMonth(), start.getDate() + index),
  )
}
