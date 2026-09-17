import { describe, expect, it } from 'vitest'
import type { Subscription } from '../types'
import { parseISODate } from './dateUtils'
import type { Rates } from './rates'
import { getCategoryShares, getSpent, getTips, NO_CATEGORY } from './stats'

const today = parseISODate('2026-09-17')
const rates: Rates = { date: '2026-09-17', fetchedAt: 1, rub: { USD: 80, EUR: 90, KZT: 0.2 } }

function sub(overrides: Partial<Subscription> & Pick<Subscription, 'id'>): Subscription {
  return {
    name: overrides.id,
    price: 100,
    currency: 'RUB',
    startDate: '2026-09-20',
    billingPeriod: 'monthly',
    category: '',
    status: 'active',
    reminders: [],
    ...overrides,
  }
}

describe('доли категорий', () => {
  it('считает в рублях и сортирует по убыванию', () => {
    const items = [
      sub({ id: '1', price: 300, category: 'Кино' }),
      sub({ id: '2', price: 5, currency: 'USD', category: 'Работа' }),
      sub({ id: '3', price: 100 }),
      sub({ id: '4', price: 900, category: 'Кино', status: 'paused' }),
    ]
    expect(getCategoryShares(items, rates)).toEqual([
      { category: 'Работа', amount: 400, share: 0.5 },
      { category: 'Кино', amount: 300, share: 0.375 },
      { category: NO_CATEGORY, amount: 100, share: 0.125 },
    ])
  })

  it('без курса считает только рублёвые', () => {
    const items = [sub({ id: '1', price: 200, category: 'Кино' }), sub({ id: '2', price: 5, currency: 'USD' })]
    expect(getCategoryShares(items, null)).toEqual([{ category: 'Кино', amount: 200, share: 1 }])
  })
})

describe('фактические траты', () => {
  const items = [
    sub({
      id: '1',
      payments: [
        { date: '2026-08-31', amount: 100, currency: 'RUB' },
        { date: '2026-09-01', amount: 200, currency: 'RUB' },
        { date: '2026-09-17', amount: 1, currency: 'USD' },
      ],
    }),
    sub({ id: '2' }),
  ]

  it('суммирует платежи периода в рублях', () => {
    expect(getSpent(items, rates, parseISODate('2026-09-01'), parseISODate('2026-09-30'))).toBe(280)
    expect(getSpent(items, rates, parseISODate('2026-08-01'), parseISODate('2026-08-31'))).toBe(100)
    expect(getSpent(items, null, parseISODate('2026-09-01'), parseISODate('2026-09-30'))).toBe(200)
  })
})

describe('подсказки', () => {
  it('просрочка, пробный период, крупная категория и неактивные', () => {
    const items = [
      sub({ id: 'overdue', name: 'Spotify', price: 500, startDate: '2026-09-01' }),
      sub({ id: 'trial', name: 'Okko', price: 399, trialUntil: '2026-09-19' }),
      sub({ id: 'big', price: 4000, category: 'Кино' }),
      sub({ id: 'off', status: 'cancelled' }),
    ]
    const tips = getTips(items, today, rates)
    expect(tips.map((tip) => tip.id)).toEqual(['overdue', 'trial:trial', 'biggest-category', 'inactive'])
    expect(tips[0].text).toContain('Просрочено платежей: 1')
    expect(tips[1].text).toContain('через 2 дня')
    expect(tips[2].tone).toBe('info')
  })

  it('без поводов подсказок нет', () => {
    expect(getTips([sub({ id: 'ok' })], today, rates)).toEqual([])
  })
})
