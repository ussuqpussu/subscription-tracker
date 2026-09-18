import { describe, expect, it } from 'vitest'
import type { Subscription } from '../types'
import {
  buildPushReminders,
  DEFAULT_REMINDER_SETTINGS,
  MAX_PUSH_REMINDERS,
  normalizeReminderSettings,
  type ReminderSettings,
} from './pushReminders'

// 17 сентября 2026, 12:00 по местному времени: утреннее напоминание сегодня уже прошло.
const now = new Date(2026, 8, 17, 12, 0)
const at = (month: number, day: number, year = 2026) => new Date(year, month - 1, day, 10).getTime()

function sub(overrides: Partial<Subscription> & Pick<Subscription, 'id'>): Subscription {
  return {
    name: overrides.id,
    price: 299,
    currency: 'RUB',
    startDate: '2026-09-20',
    billingPeriod: 'monthly',
    category: '',
    status: 'active',
    reminders: [1, 3],
    ...overrides,
  }
}

describe('расписание пушей', () => {
  it('за каждое число дней до каждого платежа в пределах 120 дней', () => {
    const reminders = buildPushReminders([sub({ id: 'k', name: 'Кинопоиск' })], now)
    // 17.09 10:00 уже прошло; дальше 19.09, затем по два на 20.10, 20.11 и 20.12. 20.01 за горизонтом.
    expect(reminders.map((item) => item.at)).toEqual([
      at(9, 19),
      at(10, 17),
      at(10, 19),
      at(11, 17),
      at(11, 19),
      at(12, 17),
      at(12, 19),
    ])
    expect(reminders[0].title).toBe('Кинопоиск: платёж завтра')
    expect(reminders[0].body.replace(/[  ]/g, ' ')).toBe('299 ₽ · 20 сентября')
    expect(reminders[0].tag).toBe('k:2026-09-20:1')
    expect(reminders[1].title).toBe('Кинопоиск: платёж через 3 дня')
  })

  it('без неактивных подписок и подписок без напоминаний', () => {
    const items = [
      sub({ id: 'p', status: 'paused' }),
      sub({ id: 'c', status: 'cancelled' }),
      sub({ id: 'n', reminders: [] }),
    ]
    expect(buildPushReminders(items, now)).toEqual([])
  })

  it('год в дате, если платёж в следующем году', () => {
    const [reminder] = buildPushReminders(
      [sub({ id: 'y', startDate: '2027-01-05', billingPeriod: 'yearly', reminders: [7] })],
      now,
    )
    expect(reminder.at).toBe(at(12, 29))
    expect(reminder.body.replace(/[  ]/g, ' ')).toBe('299 ₽ · 5 января 2027 г.')
  })

  it('просроченный платёж пропускается, следующие остаются', () => {
    const reminders = buildPushReminders([sub({ id: 'o', startDate: '2026-09-01', reminders: [3] })], now)
    expect(reminders[0].at).toBe(at(9, 28))
  })

  it('напоминание накануне конца пробного периода', () => {
    const [reminder] = buildPushReminders(
      [sub({ id: 't', name: 'Okko', price: 399, trialUntil: '2026-09-25', reminders: [] })],
      now,
    )
    expect(reminder.at).toBe(at(9, 24))
    expect(reminder.title).toBe('Okko: пробный период заканчивается завтра')
    expect(reminder.body.replace(/[  ]/g, ' ')).toBe('Дальше спишется 399 ₽ · 25 сентября')
    expect(reminder.tag).toBe('t:trial:2026-09-25')
  })

  it('время берётся из настроек', () => {
    const [reminder] = buildPushReminders([sub({ id: 'h' })], now, { ...DEFAULT_REMINDER_SETTINGS, hour: 20 })
    // 17.09 20:00 ещё впереди: это напоминание за 3 дня.
    expect(reminder.at).toBe(new Date(2026, 8, 17, 20).getTime())
  })

  it('выключенные тихие часы ничего не сдвигают', () => {
    const settings: ReminderSettings = { hour: 7, quietEnabled: false, quietStart: 23, quietEnd: 8 }
    const [reminder] = buildPushReminders([sub({ id: 'q' })], now, settings)
    expect(reminder.at).toBe(new Date(2026, 8, 19, 7).getTime())
  })

  it('утренний час внутри тишины сдвигается на её конец в тот же день', () => {
    const settings: ReminderSettings = { hour: 7, quietEnabled: true, quietStart: 23, quietEnd: 8 }
    const [reminder] = buildPushReminders([sub({ id: 'q' })], now, settings)
    expect(reminder.at).toBe(new Date(2026, 8, 19, 8).getTime())
  })

  it('вечерний час внутри тишины ждёт утра следующего дня', () => {
    const settings: ReminderSettings = { hour: 23, quietEnabled: true, quietStart: 23, quietEnd: 8 }
    const [reminder] = buildPushReminders([sub({ id: 'q' })], now, settings)
    // Напоминание за 3 дня приходится на 17.09 23:00 → 18.09 08:00.
    expect(reminder.at).toBe(new Date(2026, 8, 18, 8).getTime())
  })

  it('час вне тишины остаётся на месте', () => {
    const settings: ReminderSettings = { hour: 10, quietEnabled: true, quietStart: 23, quietEnd: 8 }
    expect(buildPushReminders([sub({ id: 'q' })], now, settings)[0].at).toBe(at(9, 19))
  })

  it('не больше лимита, самые ранние первыми', () => {
    const daily = sub({ id: 'd', billingPeriod: 'custom', customDays: 1, startDate: '2026-09-18', reminders: [1, 2, 3] })
    const reminders = buildPushReminders([daily], now)
    expect(reminders).toHaveLength(MAX_PUSH_REMINDERS)
    expect(reminders.every((item, index) => index === 0 || reminders[index - 1].at <= item.at)).toBe(true)
    expect(reminders[0].at).toBe(at(9, 18))
  })
})

describe('настройки напоминаний', () => {
  it('пустое и испорченное хранилище — значения по умолчанию', () => {
    expect(normalizeReminderSettings(undefined)).toEqual(DEFAULT_REMINDER_SETTINGS)
    expect(normalizeReminderSettings({ hour: 42, quietStart: -1, quietEnd: 'ночь' })).toEqual(
      DEFAULT_REMINDER_SETTINGS,
    )
  })

  it('сохранённые значения проходят как есть', () => {
    const settings: ReminderSettings = { hour: 9, quietEnabled: true, quietStart: 22, quietEnd: 7 }
    expect(normalizeReminderSettings(settings)).toEqual(settings)
  })
})
