import { describe, expect, it } from 'vitest'
import type { Subscription } from '../types'
import { backupFileName, createBackup, parseBackup } from './backup'
import { normalizeSubscriptions } from './subscriptionSchema'
import { parseAmount, validateDraft, createEmptyDraft } from './validation'

const subscriptions: Subscription[] = [
  {
    id: '1',
    name: 'Spotify',
    price: 169,
    currency: 'RUB',
    startDate: '2026-02-03',
    billingPeriod: 'monthly',
    category: 'Музыка',
    status: 'active',
    reminders: [1, 3],
    paidThrough: '2026-09-03',
  },
  {
    id: '2',
    name: 'iCloud+',
    price: 2.99,
    currency: 'USD',
    startDate: '2025-12-20',
    billingPeriod: 'custom',
    customDays: 28,
    category: '',
    status: 'paused',
    notes: 'Семейный доступ',
    reminders: [],
  },
]

describe('резервная копия', () => {
  it('сохраняет и восстанавливает подписки без потерь', () => {
    const text = createBackup(subscriptions, new Date('2026-09-17T10:00:00Z'))
    const result = parseBackup(text)
    expect(result).toEqual({ ok: true, subscriptions, skipped: 0 })
    expect(backupFileName(new Date(2026, 8, 17))).toBe('podpiski-backup-2026-09-17.json')
  })

  it('отклоняет не-JSON и чужие файлы', () => {
    expect(parseBackup('не json')).toMatchObject({ ok: false })
    expect(parseBackup('{"subscriptions": []}')).toMatchObject({ ok: false })
    expect(parseBackup('[1,2,3]')).toMatchObject({ ok: false })
    expect(
      parseBackup(JSON.stringify({ app: 'subscription-tracker', version: 99, subscriptions: [] })),
    ).toMatchObject({ ok: false })
  })

  it('пропускает испорченные записи и повторы id', () => {
    const text = JSON.stringify({
      app: 'subscription-tracker',
      version: 1,
      subscriptions: [
        subscriptions[0],
        { ...subscriptions[1], startDate: '2026-02-30' },
        { ...subscriptions[0], name: 'Дубликат' },
        { ...subscriptions[1], id: '3', billingPeriod: 'custom', customDays: 0 },
        { ...subscriptions[1], id: '4', extra: 'лишнее поле', reminders: [3, 3, 'x', 1, 999] },
      ],
    })
    const result = parseBackup(text)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.skipped).toBe(3)
    expect(result.subscriptions.map((item) => item.id)).toEqual(['1', '4'])
    expect(result.subscriptions[1]).not.toHaveProperty('extra')
    expect(result.subscriptions[1].reminders).toEqual([1, 3])
  })

  it('копия, где нет ни одной корректной записи, — ошибка', () => {
    const text = JSON.stringify({ app: 'subscription-tracker', version: 1, subscriptions: [{ id: 1 }] })
    expect(parseBackup(text)).toMatchObject({ ok: false })
  })

  it('данные из localStorage проходят ту же проверку', () => {
    expect(normalizeSubscriptions('мусор')).toEqual({ items: [], skipped: 0 })
    expect(normalizeSubscriptions([null, subscriptions[0]]).items).toEqual([subscriptions[0]])
  })
})

describe('валидация формы', () => {
  it('без названия и даты форма не сохраняется', () => {
    const result = validateDraft({ ...createEmptyDraft(''), price: '100' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(Object.keys(result.errors).sort()).toEqual(['name', 'startDate'])
  })

  it('проверяет сумму и свой интервал', () => {
    const draft = { ...createEmptyDraft('2026-09-17'), name: 'Тест', price: 'abc', billingPeriod: 'custom' as const, customDays: '0' }
    const result = validateDraft(draft)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(Object.keys(result.errors).sort()).toEqual(['customDays', 'price'])
  })

  it('собирает подписку из корректной формы', () => {
    const result = validateDraft({
      ...createEmptyDraft('2026-09-17'),
      name: '  YouTube Premium ',
      price: '1 299,5',
      category: ' Видео ',
      notes: '   ',
      reminders: [7, 1, 7],
    })
    expect(result).toEqual({
      ok: true,
      value: {
        name: 'YouTube Premium',
        price: 1299.5,
        currency: 'RUB',
        startDate: '2026-09-17',
        billingPeriod: 'monthly',
        category: 'Видео',
        status: 'active',
        reminders: [1, 7],
      },
    })
  })

  it('разбирает суммы с пробелами и запятой', () => {
    expect(parseAmount('1 299,90')).toBe(1299.9)
    expect(parseAmount('0')).toBe(0)
    expect(parseAmount('12.345')).toBeNaN()
    expect(parseAmount('-5')).toBeNaN()
  })
})
