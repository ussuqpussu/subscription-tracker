import type { BillingPeriod, Currency, Status } from './types'

export const STORAGE_KEY = 'subscription-tracker:v1'

/** Режим «глаз закрыт» на главной карточке. */
export const HIDE_AMOUNTS_KEY = 'subscription-tracker:hide-amounts'

/** Синхронизация: код и версия хранилища. */
export const SYNC_KEY = 'subscription-tracker:sync'

/** Когда последний раз сохраняли резервную копию. */
export const LAST_BACKUP_KEY = 'subscription-tracker:last-backup'

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

/** Готовые сервисы для быстрого добавления: подставляют название, сайт и категорию. */
export interface ServicePreset {
  name: string
  /** Адрес, с которого берётся логотип. Выбран тот, где есть чёткая иконка. */
  url: string
  category: string
}

export const SERVICE_PRESETS: readonly ServicePreset[] = [
  { name: 'Яндекс Плюс', url: 'https://ya.ru/', category: 'Развлечения' },
  { name: 'Кинопоиск', url: 'https://www.kinopoisk.ru/', category: 'Кино' },
  { name: 'Яндекс Музыка', url: 'https://music.yandex.ru/', category: 'Музыка' },
  { name: 'VK Музыка', url: 'https://vk.com/music', category: 'Музыка' },
  { name: 'Spotify', url: 'https://open.spotify.com/', category: 'Музыка' },
  { name: 'YouTube Premium', url: 'https://www.youtube.com/', category: 'Видео' },
  { name: 'Netflix', url: 'https://help.netflix.com/', category: 'Кино' },
  { name: 'Okko', url: 'https://okko.tv/', category: 'Кино' },
  { name: 'Иви', url: 'https://www.ivi.ru/', category: 'Кино' },
  { name: 'Wink', url: 'https://wink.ru/', category: 'Кино' },
  { name: 'Литрес', url: 'https://www.litres.ru/', category: 'Книги' },
  { name: 'СберПрайм', url: 'https://sber.ru/prime', category: 'Развлечения' },
  { name: 'iCloud+', url: 'https://www.icloud.com/', category: 'Облако' },
  { name: 'Google One', url: 'https://one.google.com/', category: 'Облако' },
  { name: 'Telegram Premium', url: 'https://telegram.org/', category: 'Связь' },
  { name: 'ChatGPT Plus', url: 'https://chatgpt.com/', category: 'Работа' },
  { name: 'Notion', url: 'https://www.notion.so/', category: 'Работа' },
  { name: 'GitHub', url: 'https://github.com/', category: 'Работа' },
  { name: 'Duolingo', url: 'https://www.duolingo.com/', category: 'Учёба' },
  { name: 'PlayStation Plus', url: 'https://www.playstation.com/', category: 'Игры' },
]
