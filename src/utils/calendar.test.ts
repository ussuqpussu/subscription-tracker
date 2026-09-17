import { describe, expect, it } from 'vitest'
import type { Subscription } from '../types'
import { addMonths, getMonthEvents, getMonthGrid, getMonthTotal, startOfMonth } from './calendar'
import { parseISODate, toISODate } from './dateUtils'
import type { Rates } from './rates'

const september = parseISODate('2026-09-17')
const rates: Rates = { date: '2026-09-17', fetchedAt: 1, rub: { USD: 80, EUR: 90, KZT: 0.2 } }

function sub(overrides: Partial<Subscription> & Pick<Subscription, 'id'>): Subscription {
  return {
    name: overrides.id,
    price: 100,
    currency: 'RUB',
    startDate: '2026-09-10',
    billingPeriod: 'monthly',
    category: '',
    status: 'active',
    reminders: [],
    ...overrides,
  }
}

const days = (subscriptions: Subscription[], month = september) =>
  [...getMonthEvents(subscriptions, month)].map(([date, events]) => [date, events.map((event) => event.type)]).sort()

describe('события месяца', () => {
  it('месячная подписка попадает один раз', () => {
    expect(days([sub({ id: 'm' })])).toEqual([['2026-09-10', ['payment']]])
  })

  it('недельная — на каждую неделю месяца', () => {
    const weekly = sub({ id: 'w', billingPeriod: 'weekly', startDate: '2026-09-03' })
    expect(days([weekly]).map(([date]) => date)).toEqual([
      '2026-09-03',
      '2026-09-10',
      '2026-09-17',
      '2026-09-24',
    ])
  })

  it('годовая подписка — только в своём месяце', () => {
    const yearly = sub({ id: 'y', billingPeriod: 'yearly', startDate: '2026-12-05' })
    expect(days([yearly])).toEqual([])
    expect(days([yearly], parseISODate('2026-12-01'))).toEqual([['2026-12-05', ['payment']]])
  })

  it('конец пробного периода — отдельное событие', () => {
    const trial = sub({ id: 't', trialUntil: '2026-09-21', startDate: '2026-09-21' })
    expect(days([trial])).toEqual([['2026-09-21', ['payment', 'trial']]])
  })

  it('неактивные подписки не показываются', () => {
    expect(days([sub({ id: 'p', status: 'paused' }), sub({ id: 'c', status: 'cancelled' })])).toEqual([])
  })
})

describe('итог месяца', () => {
  it('складывает платежи в рублях, пробные периоды не считает', () => {
    const events = getMonthEvents(
      [
        sub({ id: 'r', price: 299 }),
        sub({ id: 'u', price: 5, currency: 'USD', startDate: '2026-09-12' }),
        sub({ id: 't', price: 1000, startDate: '2026-10-01', trialUntil: '2026-09-25' }),
      ],
      september,
    )
    expect(getMonthTotal(events, rates)).toEqual({ amount: 699, payments: 2 })
    expect(getMonthTotal(events, null)).toEqual({ amount: 299, payments: 2 })
  })
})

describe('сетка месяца', () => {
  it('42 дня с понедельника, месяц целиком внутри', () => {
    const grid = getMonthGrid(september)
    expect(grid).toHaveLength(42)
    expect(toISODate(grid[0])).toBe('2026-08-31')
    expect(toISODate(grid[41])).toBe('2026-10-11')
    expect(grid[0].getDay()).toBe(1)
  })

  it('соседние месяцы считаются от первого числа', () => {
    expect(toISODate(startOfMonth(september))).toBe('2026-09-01')
    expect(toISODate(addMonths(september, -1))).toBe('2026-08-01')
    expect(toISODate(addMonths(september, 4))).toBe('2027-01-01')
  })
})
