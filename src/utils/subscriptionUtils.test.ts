import { describe, expect, it } from 'vitest'
import { subscriptionsReducer } from '../state/subscriptionsReducer'
import type { Subscription } from '../types'
import { parseISODate } from './dateUtils'
import { formatDays, formatDueText, formatMoney, formatReminderList, getInitial } from './format'
import {
  collectCategories,
  countOverdue,
  filterSubscriptions,
  getDaysLeft,
  getLamp,
  getMonthlyEquivalent,
  markPaid,
  mergeEdit,
  sortSubscriptions,
  withInitialPaidThrough,
} from './subscriptionUtils'

const today = parseISODate('2026-09-17')

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

describe('лампочка', () => {
  it('зелёная: больше 3 дней', () => {
    expect(getLamp(sub({ id: 'a', startDate: '2026-09-21' }), today)).toBe('green')
  })

  it('жёлтая: 3 дня и меньше, включая сегодня', () => {
    expect(getLamp(sub({ id: 'a', startDate: '2026-09-20' }), today)).toBe('yellow')
    expect(getLamp(sub({ id: 'b', startDate: '2026-09-18' }), today)).toBe('yellow')
    expect(getLamp(sub({ id: 'c', startDate: '2026-09-17' }), today)).toBe('yellow')
  })

  it('красная: срок прошёл, а оплата не отмечена', () => {
    const overdue = sub({ id: 'a', startDate: '2026-08-16', paidThrough: undefined })
    expect(getDaysLeft(overdue, today)).toBe(-32)
    expect(getLamp(overdue, today)).toBe('red')
  })

  it('выключена для паузы и отмены, даже при просрочке', () => {
    expect(getLamp(sub({ id: 'a', startDate: '2026-01-01', status: 'paused' }), today)).toBe('off')
    expect(getLamp(sub({ id: 'b', startDate: '2026-01-01', status: 'cancelled' }), today)).toBe('off')
  })
})

describe('модель оплаты', () => {
  it('при создании прошлые платежи считаются оплаченными', () => {
    const created = withInitialPaidThrough(sub({ id: 'a', startDate: '2025-01-31' }), today)
    expect(created.paidThrough).toBe('2026-08-31')
    expect(getDaysLeft(created, today)).toBe(13) // 30 сентября
    expect(getLamp(created, today)).toBe('green')
  })

  it('будущий первый платёж — без отметки', () => {
    const created = withInitialPaidThrough(sub({ id: 'a', startDate: '2026-10-01' }), today)
    expect(created.paidThrough).toBeUndefined()
    expect('paidThrough' in created).toBe(false)
  })

  it('«Оплачено» переводит на следующий период, по одному платежу за нажатие', () => {
    const overdue = sub({ id: 'a', startDate: '2026-06-10', paidThrough: '2026-07-10' })
    expect(getLamp(overdue, today)).toBe('red') // 10 августа не оплачено

    const once = markPaid(overdue)
    expect(once.paidThrough).toBe('2026-08-10')
    expect(getLamp(once, today)).toBe('red') // 10 сентября тоже прошло

    const twice = markPaid(once)
    expect(twice.paidThrough).toBe('2026-09-10')
    expect(getDaysLeft(twice, today)).toBe(23)
    expect(getLamp(twice, today)).toBe('green')
  })

  it('редактирование без смены расписания сохраняет отметки', () => {
    const previous = sub({ id: 'a', startDate: '2026-06-10', paidThrough: '2026-07-10' })
    const edited = mergeEdit(previous, { ...previous, name: 'Новое имя', paidThrough: undefined }, today)
    expect(edited.paidThrough).toBe('2026-07-10')
    expect(edited.name).toBe('Новое имя')
  })

  it('смена расписания или возобновление сбрасывает просрочку', () => {
    const previous = sub({ id: 'a', startDate: '2026-06-10', paidThrough: '2026-07-10' })
    const reschedule = mergeEdit(previous, { ...previous, startDate: '2026-06-12' }, today)
    expect(reschedule.paidThrough).toBe('2026-09-12')

    const paused = { ...previous, status: 'paused' as const }
    const resumed = mergeEdit(paused, { ...paused, status: 'active' }, today)
    expect(resumed.paidThrough).toBe('2026-09-10')
    expect(getLamp(resumed, today)).toBe('green')
  })
})

describe('reducer', () => {
  it('add, markPaid, setPaidThrough (отмена), delete, reset', () => {
    let state = subscriptionsReducer([], {
      type: 'add',
      subscription: sub({ id: 'a', startDate: '2026-09-15', billingPeriod: 'weekly' }),
      today,
    })
    expect(state[0].paidThrough).toBe('2026-09-15')

    const before = state[0].paidThrough
    state = subscriptionsReducer(state, { type: 'markPaid', id: 'a' })
    expect(state[0].paidThrough).toBe('2026-09-22')

    state = subscriptionsReducer(state, { type: 'setPaidThrough', id: 'a', paidThrough: before })
    expect(state[0].paidThrough).toBe('2026-09-15')

    const same = subscriptionsReducer(state, { type: 'markPaid', id: 'missing' })
    expect(same).toBe(state)

    state = subscriptionsReducer(state, { type: 'delete', id: 'a' })
    expect(state).toEqual([])
    expect(subscriptionsReducer([sub({ id: 'x' })], { type: 'reset' })).toEqual([])
  })
})

describe('список', () => {
  it('сортировка: просроченные первыми, неактивные в конце', () => {
    const items = [
      sub({ id: 'later', startDate: '2026-10-01' }),
      sub({ id: 'paused', startDate: '2026-09-18', status: 'paused', name: 'Б' }),
      sub({ id: 'overdue', startDate: '2026-09-01' }),
      sub({ id: 'soon', startDate: '2026-09-18' }),
      sub({ id: 'cancelled', startDate: '2026-09-17', status: 'cancelled', name: 'А' }),
    ]
    expect(sortSubscriptions(items, today).map((item) => item.id)).toEqual([
      'overdue',
      'soon',
      'later',
      'cancelled',
      'paused',
    ])
  })

  it('категории без повторов и пустых, по алфавиту', () => {
    const items = [
      sub({ id: '1', category: 'Музыка' }),
      sub({ id: '2', category: ' кино ' }),
      sub({ id: '3', category: '' }),
      sub({ id: '4', category: 'музыка' }),
      sub({ id: '5', category: 'Облако' }),
    ]
    expect(collectCategories(items)).toEqual(['кино', 'Музыка', 'Облако'])
  })

  it('фильтры по статусу и категории', () => {
    const items = [
      sub({ id: '1', category: 'Музыка' }),
      sub({ id: '2', category: 'Кино', status: 'paused' }),
      sub({ id: '3', category: 'музыка', status: 'paused' }),
    ]
    expect(filterSubscriptions(items, { status: 'paused', category: null }).map((i) => i.id)).toEqual(['2', '3'])
    expect(filterSubscriptions(items, { status: 'all', category: 'МУЗЫКА' }).map((i) => i.id)).toEqual(['1', '3'])
    expect(filterSubscriptions(items, { status: 'active', category: 'Кино' })).toEqual([])
  })
})

describe('сводка', () => {
  it('месячный эквивалент для каждого периода', () => {
    expect(getMonthlyEquivalent(sub({ id: 'w', price: 120, billingPeriod: 'weekly' }))).toBeCloseTo(520)
    expect(getMonthlyEquivalent(sub({ id: 'm', price: 120 }))).toBe(120)
    expect(getMonthlyEquivalent(sub({ id: 'q', price: 120, billingPeriod: 'quarterly' }))).toBe(40)
    expect(getMonthlyEquivalent(sub({ id: 'b', price: 120, billingPeriod: 'biannual' }))).toBe(20)
    expect(getMonthlyEquivalent(sub({ id: 'y', price: 120, billingPeriod: 'yearly' }))).toBe(10)
    expect(
      getMonthlyEquivalent(sub({ id: 'c', price: 100, billingPeriod: 'custom', customDays: 30 })),
    ).toBeCloseTo(101.46, 2)
  })

  it('считает просроченные', () => {
    const items = [
      sub({ id: '1', startDate: '2026-09-01' }),
      sub({ id: '2', startDate: '2026-09-20' }),
      sub({ id: '3', startDate: '2026-09-01', status: 'paused' }),
    ]
    expect(countOverdue(items, today)).toBe(1)
  })
})

describe('форматирование ru-RU', () => {
  it('дни и сроки', () => {
    expect(formatDays(1)).toBe('1 день')
    expect(formatDays(3)).toBe('3 дня')
    expect(formatDays(5)).toBe('5 дней')
    expect(formatDays(21)).toBe('21 день')
    expect(formatDays(112)).toBe('112 дней')
    expect(formatDueText(0)).toBe('сегодня')
    expect(formatDueText(1)).toBe('завтра')
    expect(formatDueText(4)).toBe('через 4 дня')
    expect(formatDueText(-2)).toBe('просрочено на 2 дня')
    expect(formatReminderList([7, 1, 3])).toBe('1, 3 и 7 дней')
    expect(formatReminderList([1])).toBe('1 день')
  })

  it('деньги через Intl.NumberFormat', () => {
    const normalize = (value: string) => value.replace(/[  ]/g, ' ')
    expect(normalize(formatMoney(1299, 'RUB'))).toBe('1 299 ₽')
    expect(normalize(formatMoney(9.9, 'USD'))).toBe('9,90 $')
    expect(normalize(formatMoney(249.1666, 'EUR'))).toBe('249,17 €')
    expect(normalize(formatMoney(15000, 'KZT'))).toBe('15 000 ₸')
  })

  it('буква плитки-логотипа', () => {
    expect(getInitial('  кинопоиск')).toBe('К')
    expect(getInitial('🎬 Кино')).toBe('🎬')
    expect(getInitial('')).toBe('')
  })
})
