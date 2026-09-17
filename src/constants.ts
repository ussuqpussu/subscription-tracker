import type { BillingPeriod, Currency, Status } from './types'

export const STORAGE_KEY = 'subscription-tracker:v1'

/** Режим «глаз закрыт» на главной карточке. */
export const HIDE_AMOUNTS_KEY = 'subscription-tracker:hide-amounts'

/** Последние курсы ЦБ для сводки трат в рублях. */
export const RATES_KEY = 'subscription-tracker:rates'

export const CURRENCIES: readonly Currency[] = ['RUB', 'USD', 'EUR', 'KZT']

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
  KZT: '₸',
}

export const BILLING_PERIODS: readonly BillingPeriod[] = [
  'weekly',
  'monthly',
  'quarterly',
  'biannual',
  'yearly',
  'custom',
]

export const BILLING_PERIOD_LABELS: Record<BillingPeriod, string> = {
  weekly: 'Каждую неделю',
  monthly: 'Каждый месяц',
  quarterly: 'Раз в квартал',
  biannual: 'Раз в полгода',
  yearly: 'Каждый год',
  custom: 'Свой интервал',
}

export const STATUSES: readonly Status[] = ['active', 'paused', 'cancelled']

export const STATUS_LABELS: Record<Status, string> = {
  active: 'Активна',
  paused: 'На паузе',
  cancelled: 'Отменена',
}

export const REMINDER_PRESETS: readonly number[] = [1, 3, 7, 14]

/** Жёлтая лампочка горит, если до платежа осталось столько дней или меньше. */
export const SOON_THRESHOLD_DAYS = 3

export const MAX_REMINDER_DAYS = 365
export const MAX_CUSTOM_DAYS = 3650
export const MIN_YEAR = 1970
export const MAX_YEAR = 2100
