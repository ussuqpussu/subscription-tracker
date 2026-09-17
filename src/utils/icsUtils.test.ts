import ICAL from 'ical.js'
import { describe, expect, it } from 'vitest'
import type { Subscription } from '../types'
import { getPaymentDate, parseISODate, toISODate } from './dateUtils'
import {
  buildRecurrence,
  createAllSubscriptionsIcs,
  createSubscriptionIcs,
  escapeText,
  foldLine,
  icsFileName,
} from './icsUtils'

const now = new Date(Date.UTC(2026, 8, 17, 9, 30, 5))
const today = parseISODate('2026-09-17')

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: '5b0f7a1e-1111-4c2e-9a53-0c1d2e3f4a5b',
    name: 'Netflix',
    price: 999,
    currency: 'RUB',
    startDate: '2026-01-10',
    billingPeriod: 'monthly',
    category: 'Кино',
    status: 'active',
    reminders: [1, 3],
    ...overrides,
  }
}

function parseEvents(text: string) {
  const calendar = new ICAL.Component(ICAL.parse(text))
  return { calendar, events: calendar.getAllSubcomponents('vevent') }
}

const encoder = new TextEncoder()

describe('формат файла', () => {
  it('строки разделены CRLF, каждая не длиннее 75 октетов', () => {
    const text = createSubscriptionIcs(
      sub({
        name: 'Очень длинное название подписки на онлайн-кинотеатр с кириллицей и эмодзи 🎬🎬🎬',
        notes: 'Заметка: '.repeat(20),
      }),
      { now, today },
    )
    expect(text.endsWith('\r\n')).toBe(true)
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    for (const line of text.split('\r\n')) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    }
  })

  it('foldLine не режет многобайтовые символы и восстанавливается разворачиванием', () => {
    const line = `SUMMARY:${'Ж'.repeat(100)}`
    const folded = foldLine(line)
    expect(folded.split('\r\n ').join('')).toBe(line)
    expect(folded).not.toContain('�')
  })

  it('экранирует спецсимволы', () => {
    expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne')
  })

  it('обязательные свойства календаря и события', () => {
    const text = createSubscriptionIcs(sub(), { now, today })
    const { calendar, events } = parseEvents(text)
    expect(calendar.getFirstPropertyValue('version')).toBe('2.0')
    expect(calendar.getFirstPropertyValue('prodid')).toBeTruthy()
    expect(events).toHaveLength(1)

    const event = events[0]
    expect(event.getFirstPropertyValue('uid')).toBe('5b0f7a1e-1111-4c2e-9a53-0c1d2e3f4a5b@subscription-tracker')
    expect(String(event.getFirstPropertyValue('dtstamp'))).toBe('2026-09-17T09:30:05Z')
    expect(String(event.getFirstPropertyValue('dtstart'))).toBe('2026-10-10')
    expect(String(event.getFirstPropertyValue('dtend'))).toBe('2026-10-11')
    expect(text).toContain('DTSTART;VALUE=DATE:20261010')
    expect(String(event.getFirstPropertyValue('summary')).replace(/[  ]/g, ' ')).toBe('Netflix — 999 ₽')
  })

  it('текст с запятыми, точкой с запятой и переносами переживает разбор', () => {
    const name = 'Облако; 2 ТБ, семья \\ дом'
    const notes = 'Первая строка\nВторая, с запятой'
    const { events } = parseEvents(createSubscriptionIcs(sub({ name, notes }), { now, today }))
    expect(String(events[0].getFirstPropertyValue('summary'))).toContain(name)
    expect(String(events[0].getFirstPropertyValue('description'))).toContain(notes)
  })

  it('VALARM на каждое напоминание: TRIGGER:-P{N}D', () => {
    const text = createSubscriptionIcs(sub({ reminders: [1, 3, 7] }), { now, today })
    const alarms = parseEvents(text).events[0].getAllSubcomponents('valarm')
    expect(alarms).toHaveLength(3)
    expect(alarms.map((alarm) => String(alarm.getFirstPropertyValue('trigger')))).toEqual([
      '-P1D',
      '-P3D',
      '-P7D',
    ])
    expect(alarms.every((alarm) => alarm.getFirstPropertyValue('action') === 'DISPLAY')).toBe(true)
    expect(text).toContain('TRIGGER:-P7D')
  })

  it('без напоминаний VALARM нет', () => {
    const { events } = parseEvents(createSubscriptionIcs(sub({ reminders: [] }), { now, today }))
    expect(events[0].getAllSubcomponents('valarm')).toHaveLength(0)
  })
})

describe('RRULE', () => {
  const rules = (overrides: Partial<Subscription>) =>
    buildRecurrence(sub(overrides), today).map((series) => series.rrule)

  it('соответствует периодичности', () => {
    expect(rules({ billingPeriod: 'weekly' })).toEqual(['FREQ=WEEKLY'])
    expect(rules({ billingPeriod: 'monthly' })).toEqual(['FREQ=MONTHLY'])
    expect(rules({ billingPeriod: 'quarterly' })).toEqual(['FREQ=MONTHLY;INTERVAL=3'])
    expect(rules({ billingPeriod: 'biannual' })).toEqual(['FREQ=MONTHLY;INTERVAL=6'])
    expect(rules({ billingPeriod: 'yearly' })).toEqual(['FREQ=YEARLY'])
    expect(rules({ billingPeriod: 'custom', customDays: 45 })).toEqual(['FREQ=DAILY;INTERVAL=45'])
  })

  it('конец месяца без BYSETPOS', () => {
    expect(rules({ startDate: '2026-01-31' })).toEqual(['FREQ=MONTHLY;BYMONTHDAY=-1'])
    // Ноябрь, февраль, май, август: февральский платёж — отдельной серией.
    expect(rules({ startDate: '2025-11-30', billingPeriod: 'quarterly' })).toEqual([
      'FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=30',
      'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1',
    ])
    // Январь, апрель, июль, октябрь: февраль в цикл не попадает, вторая серия не нужна.
    expect(rules({ startDate: '2026-01-30', billingPeriod: 'quarterly' })).toEqual([
      'FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=30',
    ])
    const leapSafe = buildRecurrence(sub({ startDate: '2026-01-29' }), today)
    expect(leapSafe.map((series) => series.uidSuffix)).toEqual(['', '-feb'])
    expect(leapSafe[0].exdates.map(toISODate)).toContain('2028-02-29')
    expect(rules({ startDate: '2024-02-29', billingPeriod: 'yearly' })).toEqual([
      'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1',
    ])
  })

  /** Все даты событий из файла до `until`, по всем VEVENT и с учётом EXDATE. */
  function expandCalendar(text: string, until: string): string[] {
    const dates: string[] = []
    for (const component of parseEvents(text).events) {
      const iterator = new ICAL.Event(component).iterator()
      for (let next = iterator.next(); next && next.toString() < until; next = iterator.next()) {
        dates.push(next.toString())
      }
    }
    return dates.sort()
  }

  it.each([
    ['monthly', '2026-01-31', '2026-02-10'],
    ['monthly', '2026-01-30', '2026-01-31'],
    ['monthly', '2026-01-29', '2026-01-30'],
    ['monthly', '2023-12-29', '2027-09-17'],
    ['quarterly', '2025-11-30', '2025-12-01'],
    ['quarterly', '2025-11-29', '2026-09-17'],
    ['quarterly', '2026-01-31', '2026-09-17'],
    ['biannual', '2025-08-31', '2025-09-01'],
    ['biannual', '2025-08-29', '2025-09-01'],
    ['biannual', '2026-03-30', '2026-09-17'],
    ['yearly', '2024-02-29', '2024-03-01'],
    ['yearly', '2025-12-31', '2026-09-17'],
    ['monthly', '2026-03-15', '2026-09-17'],
    ['weekly', '2026-09-01', '2026-09-17'],
    ['custom', '2026-01-01', '2026-09-17'],
  ] as const)('%s от %s (сегодня %s): календарь совпадает с приложением', (billingPeriod, startDate, todayISO) => {
    const subscription = sub({ billingPeriod, startDate, customDays: billingPeriod === 'custom' ? 10 : undefined })
    const localToday = parseISODate(todayISO)
    const until = `${localToday.getFullYear() + 12}-01-01`
    const fromCalendar = expandCalendar(createSubscriptionIcs(subscription, { now, today: localToday }), until)

    const fromApp: string[] = []
    for (let index = 0; ; index += 1) {
      const date = toISODate(getPaymentDate(subscription, index))
      if (date >= until) break
      if (date >= todayISO) fromApp.push(date)
    }
    expect(fromCalendar.length).toBeGreaterThan(8)
    expect(fromCalendar).toEqual(fromApp)
  })
})

describe('экспорт всех', () => {
  it('один календарь с событиями только активных подписок', () => {
    const text = createAllSubscriptionsIcs(
      [
        sub({ id: 'a', name: 'A' }),
        sub({ id: 'b', name: 'B', status: 'paused' }),
        sub({ id: 'c', name: 'C', billingPeriod: 'yearly' }),
      ],
      { now, today },
    )
    const { events } = parseEvents(text)
    expect(events.map((event) => event.getFirstPropertyValue('uid'))).toEqual([
      'a@subscription-tracker',
      'c@subscription-tracker',
    ])
    expect(text.match(/BEGIN:VCALENDAR/g)).toHaveLength(1)
  })
})

describe('имя файла', () => {
  it('убирает недопустимые символы', () => {
    expect(icsFileName('Яндекс Плюс: семья / 4 чел.')).toBe('Яндекс Плюс семья 4 чел..ics')
    expect(icsFileName('   ')).toBe('Подписка.ics')
  })
})
