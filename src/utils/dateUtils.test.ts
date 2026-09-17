import { afterEach, describe, expect, it } from 'vitest'
import type { Schedule } from '../types'
import {
  addMonthsClamped,
  getDaysUntil,
  getDueDate,
  getLastPaymentBefore,
  getNextPaymentDate,
  getPaymentDate,
  isValidISODate,
  parseISODate,
  toISODate,
} from './dateUtils'

const d = parseISODate
const iso = toISODate

function schedule(startDate: string, billingPeriod: Schedule['billingPeriod'], customDays?: number): Schedule {
  return { startDate, billingPeriod, customDays }
}

describe('parseISODate / toISODate', () => {
  it('разбирает дату в локальную полночь без сдвига дня', () => {
    const date = d('2024-01-31')
    expect(date.getFullYear()).toBe(2024)
    expect(date.getMonth()).toBe(0)
    expect(date.getDate()).toBe(31)
    expect(date.getHours()).toBe(0)
    expect(iso(date)).toBe('2024-01-31')
  })

  it('проверяет формат и существование даты', () => {
    expect(isValidISODate('2024-02-29')).toBe(true)
    expect(isValidISODate('2023-02-29')).toBe(false)
    expect(isValidISODate('2024-13-01')).toBe(false)
    expect(isValidISODate('2024-1-01')).toBe(false)
    expect(isValidISODate('1900-01-01')).toBe(false)
    expect(isValidISODate(20240101)).toBe(false)
  })

  it('addMonthsClamped берёт последний день короткого месяца', () => {
    expect(iso(addMonthsClamped(d('2023-01-31'), 1))).toBe('2023-02-28')
    expect(iso(addMonthsClamped(d('2024-01-31'), 1))).toBe('2024-02-29')
    expect(iso(addMonthsClamped(d('2024-12-31'), 2))).toBe('2025-02-28')
    expect(iso(addMonthsClamped(d('2024-03-31'), -1))).toBe('2024-02-29')
  })
})

describe('getNextPaymentDate', () => {
  it('возвращает саму дату, если она сегодня', () => {
    const today = d('2026-09-17')
    expect(iso(getNextPaymentDate(schedule('2026-09-17', 'monthly'), today))).toBe('2026-09-17')
  })

  it('возвращает будущую дату первого платежа без изменений', () => {
    const today = d('2026-09-17')
    expect(iso(getNextPaymentDate(schedule('2026-12-01', 'yearly'), today))).toBe('2026-12-01')
  })

  it('прибавляет период, пока дата в прошлом', () => {
    const today = d('2026-09-17')
    expect(iso(getNextPaymentDate(schedule('2026-09-10', 'weekly'), today))).toBe('2026-09-17')
    expect(iso(getNextPaymentDate(schedule('2026-09-09', 'weekly'), today))).toBe('2026-09-23')
    expect(iso(getNextPaymentDate(schedule('2026-08-20', 'monthly'), today))).toBe('2026-09-20')
    expect(iso(getNextPaymentDate(schedule('2026-09-16', 'monthly'), today))).toBe('2026-10-16')
  })

  it('дата в прошлом на много периодов', () => {
    const today = d('2026-09-17')
    expect(iso(getNextPaymentDate(schedule('2019-03-05', 'monthly'), today))).toBe('2026-10-05')
    expect(iso(getNextPaymentDate(schedule('2015-09-18', 'yearly'), today))).toBe('2026-09-18')
    expect(iso(getNextPaymentDate(schedule('2020-01-01', 'weekly'), today))).toBe('2026-09-23')
    expect(iso(getNextPaymentDate(schedule('2025-01-15', 'quarterly'), today))).toBe('2026-10-15')
    expect(iso(getNextPaymentDate(schedule('2024-02-10', 'biannual'), today))).toBe('2027-02-10')
    expect(iso(getNextPaymentDate(schedule('2026-01-01', 'custom', 10), today))).toBe('2026-09-18')
  })

  it('конец месяца: 31-е не превращается в 28-е после февраля', () => {
    const sub = schedule('2025-01-31', 'monthly')
    expect(iso(getNextPaymentDate(sub, d('2025-02-01')))).toBe('2025-02-28')
    expect(iso(getNextPaymentDate(sub, d('2025-03-01')))).toBe('2025-03-31')
    expect(iso(getNextPaymentDate(sub, d('2025-04-01')))).toBe('2025-04-30')
    expect(iso(getNextPaymentDate(sub, d('2025-05-01')))).toBe('2025-05-31')
  })

  it('конец месяца для квартала и полугода', () => {
    expect(iso(getNextPaymentDate(schedule('2025-11-30', 'quarterly'), d('2025-12-01')))).toBe('2026-02-28')
    expect(iso(getNextPaymentDate(schedule('2025-11-30', 'quarterly'), d('2026-03-01')))).toBe('2026-05-30')
    expect(iso(getNextPaymentDate(schedule('2025-08-31', 'biannual'), d('2025-09-01')))).toBe('2026-02-28')
    expect(iso(getNextPaymentDate(schedule('2025-08-31', 'biannual'), d('2026-03-01')))).toBe('2026-08-31')
  })

  it('високосный год: 29 февраля', () => {
    const yearly = schedule('2024-02-29', 'yearly')
    expect(iso(getNextPaymentDate(yearly, d('2024-03-01')))).toBe('2025-02-28')
    expect(iso(getNextPaymentDate(yearly, d('2027-03-01')))).toBe('2028-02-29')
    expect(iso(getNextPaymentDate(schedule('2024-01-31', 'monthly'), d('2024-02-15')))).toBe('2024-02-29')
  })

  it('weekly и custom не зависят от длины месяца', () => {
    expect(iso(getNextPaymentDate(schedule('2024-02-26', 'weekly'), d('2024-02-27')))).toBe('2024-03-04')
    expect(iso(getNextPaymentDate(schedule('2023-12-30', 'custom', 45), d('2024-01-01')))).toBe('2024-02-13')
  })
})

describe('getPaymentDate / getLastPaymentBefore', () => {
  it('k-й платёж считается от исходной даты', () => {
    const sub = schedule('2024-01-31', 'monthly')
    expect([0, 1, 2, 3].map((k) => iso(getPaymentDate(sub, k)))).toEqual([
      '2024-01-31',
      '2024-02-29',
      '2024-03-31',
      '2024-04-30',
    ])
  })

  it('последний платёж строго до даты', () => {
    const sub = schedule('2026-01-10', 'monthly')
    expect(getLastPaymentBefore(sub, d('2026-01-10'))).toBeNull()
    expect(iso(getLastPaymentBefore(sub, d('2026-01-11'))!)).toBe('2026-01-10')
    expect(iso(getLastPaymentBefore(sub, d('2026-09-10'))!)).toBe('2026-08-10')
  })
})

describe('getDueDate', () => {
  it('без отметок об оплате срок — первый платёж', () => {
    expect(iso(getDueDate(schedule('2026-05-01', 'monthly')))).toBe('2026-05-01')
  })

  it('следующий платёж после последнего оплаченного', () => {
    const sub = { ...schedule('2026-01-31', 'monthly'), paidThrough: '2026-02-28' }
    expect(iso(getDueDate(sub))).toBe('2026-03-31')
  })

  it('пропущено несколько периодов — срок остаётся на самом старом', () => {
    const sub = { ...schedule('2026-01-05', 'monthly'), paidThrough: '2026-06-05' }
    expect(iso(getDueDate(sub))).toBe('2026-07-05')
    expect(getDaysUntil(getDueDate(sub), d('2026-09-17'))).toBe(-74)
  })
})

describe('getDaysUntil', () => {
  const originalTZ = process.env.TZ
  afterEach(() => {
    process.env.TZ = originalTZ
  })

  it('сегодня — 0, завтра — 1, вчера — -1', () => {
    const today = d('2026-09-17')
    expect(getDaysUntil(d('2026-09-17'), today)).toBe(0)
    expect(getDaysUntil('2026-09-18', today)).toBe(1)
    expect(getDaysUntil('2026-09-16', today)).toBe(-1)
  })

  it('не зависит от времени суток', () => {
    const lateEvening = new Date(2026, 8, 17, 23, 59, 59)
    expect(getDaysUntil('2026-09-18', lateEvening)).toBe(1)
  })

  it('через границы месяца и года, високосный февраль', () => {
    expect(getDaysUntil('2026-10-01', d('2026-09-30'))).toBe(1)
    expect(getDaysUntil('2027-01-01', d('2026-12-31'))).toBe(1)
    expect(getDaysUntil('2024-03-01', d('2024-02-28'))).toBe(2)
    expect(getDaysUntil('2025-01-01', d('2024-01-01'))).toBe(366)
  })

  it('переход на летнее время не даёт дробных дней', () => {
    process.env.TZ = 'America/New_York'
    expect(getDaysUntil('2026-03-09', d('2026-03-07'))).toBe(2)
    expect(getDaysUntil('2026-11-02', d('2026-10-31'))).toBe(2)
    expect(iso(getNextPaymentDate(schedule('2026-03-01', 'weekly'), d('2026-03-09')))).toBe('2026-03-15')
  })
})
