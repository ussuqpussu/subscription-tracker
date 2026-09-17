import { MAX_CUSTOM_DAYS } from '../constants'
import type { BillingPeriod, Currency, Status, Subscription } from '../types'
import { isValidISODate } from './dateUtils'
import { normalizeUrl } from './logo'
import { isValidCustomDays, normalizeReminders } from './subscriptionSchema'

/** Состояние формы: числа хранятся строками, как в полях ввода. */
export interface SubscriptionDraft {
  name: string
  price: string
  currency: Currency
  startDate: string
  billingPeriod: BillingPeriod
  customDays: string
  category: string
  status: Status
  notes: string
  /** Как введено в поле: «kinopoisk.ru» тоже подходит. */
  url: string
  /** Свой логотип (data URL) или null. */
  logo: string | null
  reminders: number[]
}

export type DraftField = 'name' | 'url' | 'price' | 'startDate' | 'customDays'

export type DraftErrors = Partial<Record<DraftField, string>>

/** Порядок полей в форме: фокус уходит на первое поле с ошибкой. */
export const DRAFT_FIELD_ORDER: readonly DraftField[] = ['name', 'url', 'price', 'startDate', 'customDays']

export const MAX_NAME_LENGTH = 80
export const MAX_CATEGORY_LENGTH = 40
export const MAX_NOTES_LENGTH = 1000

export function createEmptyDraft(today: string): SubscriptionDraft {
  return {
    name: '',
    price: '',
    currency: 'RUB',
    startDate: today,
    billingPeriod: 'monthly',
    customDays: '30',
    category: '',
    status: 'active',
    notes: '',
    url: '',
    logo: null,
    reminders: [1, 3],
  }
}

export function draftFromSubscription(subscription: Subscription): SubscriptionDraft {
  return {
    name: subscription.name,
    price: String(subscription.price).replace('.', ','),
    currency: subscription.currency,
    startDate: subscription.startDate,
    billingPeriod: subscription.billingPeriod,
    customDays: String(subscription.customDays ?? 30),
    category: subscription.category,
    status: subscription.status,
    notes: subscription.notes ?? '',
    url: subscription.url ?? '',
    logo: subscription.logo ?? null,
    reminders: [...subscription.reminders],
  }
}

/** «1 299,90» и «1299.9» → 1299.9. Пустая строка или мусор → NaN. */
export function parseAmount(value: string): number {
  const normalized = value.replace(/[\s  ]/g, '').replace(',', '.')
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return Number.NaN
  return Number(normalized)
}

export type DraftValidation =
  | { ok: true; value: Omit<Subscription, 'id' | 'paidThrough'> }
  | { ok: false; errors: DraftErrors }

export function validateDraft(draft: SubscriptionDraft): DraftValidation {
  const errors: DraftErrors = {}
  const name = draft.name.trim()
  const price = parseAmount(draft.price)
  const customDays = Number(draft.customDays.trim())
  const url = normalizeUrl(draft.url)

  if (!name) errors.name = 'Введите название подписки.'
  else if (name.length > MAX_NAME_LENGTH) errors.name = `Не длиннее ${MAX_NAME_LENGTH} символов.`

  if (draft.url.trim() !== '' && !url) errors.url = 'Ссылка на сайт, например kinopoisk.ru.'

  if (draft.price.trim() === '') errors.price = 'Введите сумму платежа.'
  else if (!Number.isFinite(price)) errors.price = 'Сумма — число, до двух знаков после запятой.'

  if (!draft.startDate) errors.startDate = 'Укажите дату платежа.'
  else if (!isValidISODate(draft.startDate)) errors.startDate = 'Дата должна быть между 1970 и 2100 годом.'

  if (draft.billingPeriod === 'custom' && (draft.customDays.trim() === '' || !isValidCustomDays(customDays))) {
    errors.customDays = `Целое число дней от 1 до ${MAX_CUSTOM_DAYS}.`
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const value: Omit<Subscription, 'id' | 'paidThrough'> = {
    name,
    price,
    currency: draft.currency,
    startDate: draft.startDate,
    billingPeriod: draft.billingPeriod,
    category: draft.category.trim().slice(0, MAX_CATEGORY_LENGTH),
    status: draft.status,
    reminders: normalizeReminders(draft.reminders),
  }
  if (draft.billingPeriod === 'custom') value.customDays = customDays
  const notes = draft.notes.trim().slice(0, MAX_NOTES_LENGTH)
  if (notes) value.notes = notes
  if (url) value.url = url
  if (draft.logo) value.logo = draft.logo
  return { ok: true, value }
}
