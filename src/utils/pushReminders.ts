import type { Subscription } from '../types'
import {
  addDays,
  compareDates,
  getDueDate,
  getPaymentDate,
  getPaymentIndexOnOrAfter,
  startOfDay,
  toISODate,
} from './dateUtils'
import { formatDate, formatDueText, formatMoney } from './format'
import { isActive } from './subscriptionUtils'

/** Напоминание, которое сервер отправит пушем в момент `at`. */
export interface PushReminder {
  /** Unix-время в миллисекундах. */
  at: number
  title: string
  body: string
  /** Одинаковый tag заменяет уведомление, а не дублирует его. */
  tag: string
}

/** На сколько дней вперёд отправляем расписание. Оно обновляется при каждом открытии приложения. */
export const PUSH_HORIZON_DAYS = 120
/** Столько напоминаний сервер принимает от одного устройства. */
export const MAX_PUSH_REMINDERS = 200
/** Во сколько по местному времени приходит напоминание. */
export const PUSH_REMINDER_HOUR = 10

/**
 * Расписание пушей: за каждое число дней из `reminders` до каждого платежа в пределах горизонта.
 * Уже прошедшие моменты пропускаются, самые ранние идут первыми.
 */
export function buildPushReminders(
  subscriptions: readonly Subscription[],
  now: Date,
  horizonDays = PUSH_HORIZON_DAYS,
): PushReminder[] {
  const today = startOfDay(now)
  const horizon = addDays(today, horizonDays)
  const reminders: PushReminder[] = []

  for (const subscription of subscriptions) {
    if (!isActive(subscription) || subscription.reminders.length === 0) continue

    // Для просроченного платежа напоминать поздно: начинаем с неоплаченного, но не раньше сегодняшнего.
    const due = getDueDate(subscription)
    const from = compareDates(due, today) > 0 ? due : today
    for (let index = getPaymentIndexOnOrAfter(subscription, from); ; index += 1) {
      const payment = getPaymentDate(subscription, index)
      if (compareDates(payment, horizon) > 0) break

      for (const days of subscription.reminders) {
        const day = addDays(payment, -days)
        const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), PUSH_REMINDER_HOUR).getTime()
        if (at <= now.getTime()) continue
        reminders.push({
          at,
          title: `${subscription.name}: платёж ${formatDueText(days)}`,
          body: `${formatMoney(subscription.price, subscription.currency)} · ${formatDate(payment, day)}`,
          tag: `${subscription.id}:${toISODate(payment)}:${days}`,
        })
      }
    }
  }

  return reminders.sort((a, b) => a.at - b.at).slice(0, MAX_PUSH_REMINDERS)
}
