import { describe, expect, it } from 'vitest'
import type { Subscription } from '../types'
import { getMonthlyTotalRub, normalizeRates, parseCbrRates, type Rates } from './rates'

const cbr = {
  Date: '2026-09-18T11:30:00+03:00',
  Valute: {
    USD: { CharCode: 'USD', Nominal: 1, Value: 84.5 },
    EUR: { CharCode: 'EUR', Nominal: 1, Value: 97.5 },
    KZT: { CharCode: 'KZT', Nominal: 100, Value: 19 },
  },
}

const rates: Rates = { date: '2026-09-18', fetchedAt: 1, rub: { USD: 84.5, EUR: 97.5, KZT: 0.19 } }

function sub(overrides: Partial<Subscription> & Pick<Subscription, 'id'>): Subscription {
  return {
    name: overrides.id,
    price: 100,
    currency: 'RUB',
    startDate: '2026-09-17',
    billingPeriod: 'monthly',
    category: '',
    status: 'active',
    reminders: [],
    ...overrides,
  }
}

describe('курсы ЦБ', () => {
  it('разбирает ответ с учётом номинала', () => {
    expect(parseCbrRates(cbr, 1)).toEqual(rates)
  })

  it('отклоняет неполный или испорченный ответ', () => {
    expect(parseCbrRates({ ...cbr, Valute: { USD: cbr.Valute.USD } }, 1)).toBeNull()
    expect(parseCbrRates({ Date: 1 }, 1)).toBeNull()
    expect(normalizeRates(rates)).toEqual(rates)
    expect(normalizeRates({ ...rates, rub: { ...rates.rub, EUR: -1 } })).toBeNull()
  })
})

describe('траты в месяц в рублях', () => {
  const items = [
    sub({ id: 'r', price: 299 }),
    sub({ id: 'u', price: 10, currency: 'USD' }),
    sub({ id: 'k', price: 1200, currency: 'KZT', billingPeriod: 'yearly' }),
    sub({ id: 'p', price: 5000, status: 'paused' }),
  ]

  it('пересчитывает другие валюты по курсу', () => {
    const total = getMonthlyTotalRub(items, rates)
    expect(total.amount).toBeCloseTo(299 + 845 + 19)
    expect(total).toMatchObject({ converted: true, missing: [] })
  })

  it('без курса считает только рубли и называет пропущенные валюты', () => {
    expect(getMonthlyTotalRub(items, null)).toEqual({ amount: 299, converted: true, missing: ['USD', 'KZT'] })
  })

  it('только рублёвые подписки — без пересчёта', () => {
    expect(getMonthlyTotalRub([sub({ id: 'r' })], null)).toEqual({ amount: 100, converted: false, missing: [] })
  })
})
