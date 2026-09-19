import type { Subscription } from '../types'
import {
  addDays,
  compareDates,
  getDueDate,
  parseISODate,
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
export const PUSH_HORIZON_DAYS = 365
/** Столько напоминаний сервер принимает от одного устройства. */
export const MAX_PUSH_REMINDERS = 200
/** Во сколько по местному времени приходит напоминание, если его не меняли. */
export const PUSH_REMINDER_HOUR = 10

/** Когда приходят пуши: час напоминаний и интервал тишины. */
export interface ReminderSettings {
  /** Час по местному времени, 0–23. */
  hour: number
  /** Не беспокоить в интервале ниже. */
  quietEnabled: boolean
  /** Начало тишины, час. */
  quietStart: number
  /** Конец тишины, час. Может быть меньше начала: интервал идёт через полночь. */
  quietEnd: number
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  hour: PUSH_REMINDER_HOUR,
  quietEnabled: false,
  quietStart: 23,
  quietEnd: 8,
}

const isHour = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23

/** Проверка настроек из localStorage: испорченное значение заменяется значением по умолчанию. */
export function normalizeReminderSettings(raw: unknown): ReminderSettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_REMINDER_SETTINGS
  const value = raw as Partial<ReminderSettings>
  return {
    hour: isHour(value.hour) ? value.hour : DEFAULT_REMINDER_SETTINGS.hour,
    quietEnabled: value.quietEnabled === true,
    quietStart: isHour(value.quietStart) ? value.quietStart : DEFAULT_REMINDER_SETTINGS.quietStart,
    quietEnd: isHour(value.quietEnd) ? value.quietEnd : DEFAULT_REMINDER_SETTINGS.quietEnd,
  }
}

/** Час внутри интервала тишины. Интервал может идти через полночь: 23 → 8. */
function isQuietHour(hour: number, { quietStart, quietEnd }: ReminderSettings): boolean {
  return quietStart < quietEnd ? hour >= quietStart && hour < quietEnd : hour >= quietStart || hour < quietEnd
}

/**
 * Момент напоминания в этот день: час из настроек, а если он попал в тихие часы —
 * ближайшее разрешённое время, то есть конец интервала тишины.
 */
export function getReminderTime(day: Date, settings: ReminderSettings): number {
  const at = (hour: number, shiftDays = 0) =>
    new Date(day.getFullYear(), day.getMonth(), day.getDate() + shiftDays, hour).getTime()
  const { hour, quietEnabled, quietStart, quietEnd } = settings
  if (!quietEnabled || quietStart === quietEnd || !isQuietHour(hour, settings)) return at(hour)
  // Вечерняя часть интервала через полночь заканчивается уже назавтра.
  return at(quietEnd, quietStart > quietEnd && hour >= quietStart ? 1 : 0)
}

/**
 * Расписание пушей: за каждое число дней из `reminders` до каждого платежа в пределах горизонта.
 * Уже прошедшие моменты пропускаются, самые ранние идут первыми.
 */
export function buildPushReminders(
  subscriptions: readonly Subscription[],
  now: Date,
  settings: ReminderSettings = DEFAULT_REMINDER_SETTINGS,
  horizonDays = PUSH_HORIZON_DAYS,
): PushReminder[] {
  const today = startOfDay(now)
  const horizon = addDays(today, horizonDays)
  const reminders: PushReminder[] = []

  for (const subscription of subscriptions) {
    if (!isActive(subscription)) continue

    // Конец пробного периода: напоминаем накануне, чтобы успеть отменить.
    if (subscription.trialUntil) {
      const trialEnd = parseISODate(subscription.trialUntil)
      const day = addDays(trialEnd, -1)
      const at = getReminderTime(day, settings)
      if (at > now.getTime() && compareDates(trialEnd, horizon) <= 0) {
        reminders.push({
          at,
          title: `${subscription.name}: пробный период заканчивается завтра`,
          body: `Дальше спишется ${formatMoney(subscription.price, subscription.currency)} · ${formatDate(trialEnd, day)}`,
          tag: `${subscription.id}:trial:${subscription.trialUntil}`,
        })
      }
    }

    if (subscription.reminders.length === 0) continue

    // Для просроченного платежа напоминать поздно: начинаем с неоплаченного, но не раньше сегодняшнего.
    const due = getDueDate(subscription)
    const from = compareDates(due, today) > 0 ? due : today
    for (let index = getPaymentIndexOnOrAfter(subscription, from); ; index += 1) {
      const payment = getPaymentDate(subscription, index)
      if (compareDates(payment, horizon) > 0) break

      for (const days of subscription.reminders) {
        const day = addDays(payment, -days)
        const at = getReminderTime(day, settings)
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
