import type { BillingPeriod, Currency, Status } from './types'

export const STORAGE_KEY = 'subscription-tracker:v1'

/** Режим «глаз закрыт» на главной карточке. */
export const HIDE_AMOUNTS_KEY = 'subscription-tracker:hide-amounts'

/** Синхронизация: код и версия хранилища. */
export const SYNC_KEY = 'subscription-tracker:sync'

/** Когда последний раз сохраняли резервную копию. */
export const LAST_BACKUP_KEY = 'subscription-tracker:last-backup'

/** Тема оформления: «Авто» следует за системной. */
export const THEME_KEY = 'subscription-tracker:theme'

/** Акцентная палитра приложения. */
export const ACCENT_KEY = 'subscription-tracker:accent'

export type ThemeMode = 'auto' | 'light' | 'dark'

export type AccentId = 'peach' | 'mint' | 'dusk' | 'lime' | 'sky' | 'garnet' | 'ocean' | 'sand' | 'graphite'

export interface AccentPalette {
  id: AccentId
  label: string
  /** Цвет образца в окне «Оформление»: акцент и градиент палитры. */
  color: string
  gradient: string
}

export const DEFAULT_ACCENT: AccentId = 'peach'

/** Палитры: id совпадает со значением data-accent в tokens.css. */
export const ACCENTS: readonly AccentPalette[] = [
  { id: 'peach', label: 'Персик', color: '#ffb4a2', gradient: 'linear-gradient(135deg, #d9486f, #e98b4f)' },
  { id: 'mint', label: 'Мята', color: '#7ee0c3', gradient: 'linear-gradient(135deg, #0f766e, #19a98c)' },
  { id: 'dusk', label: 'Сумерки', color: '#d8b4fe', gradient: 'linear-gradient(135deg, #6d28d9, #b429c7)' },
  { id: 'lime', label: 'Лайм', color: '#d4f46a', gradient: 'linear-gradient(135deg, #3f6212, #6ba31a)' },
  { id: 'sky', label: 'Небо', color: '#a8cdff', gradient: 'linear-gradient(135deg, #1d4ed8, #3e8ed0)' },
  { id: 'garnet', label: 'Гранат', color: '#ff9aa2', gradient: 'linear-gradient(135deg, #9f1239, #e11d48)' },
  { id: 'ocean', label: 'Океан', color: '#7fd7e8', gradient: 'linear-gradient(135deg, #0e7490, #1fa3a3)' },
  { id: 'sand', label: 'Песок', color: '#e8c39e', gradient: 'linear-gradient(135deg, #8a5a2b, #c98b4b)' },
  { id: 'graphite', label: 'Графит', color: '#d8d8dd', gradient: 'linear-gradient(135deg, #4b4b52, #7b7b85)' },
]

/** Последние курсы ЦБ для сводки трат в рублях. */
export const RATES_KEY = 'subscription-tracker:rates'

/** Время пуш-напоминаний и тихие часы. */
export const REMINDER_SETTINGS_KEY = 'subscription-tracker:reminder-settings'

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

/**
 * Готовые сервисы для быстрого добавления: подставляют название, сайт и категорию.
 * Это встроенный короткий список — он работает офлайн; полный каталог приходит с сервера.
 */
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
  { name: 'МТС Premium', url: 'https://mts.ru/', category: 'Развлечения' },
  { name: 'Premier', url: 'https://premier.one/', category: 'Кино' },
  { name: 'Start', url: 'https://start.ru/', category: 'Кино' },
  { name: 'KION', url: 'https://kion.ru/', category: 'Кино' },
  { name: 'Apple Music', url: 'https://music.apple.com/', category: 'Музыка' },
  { name: 'Яндекс 360', url: 'https://360.yandex.ru/', category: 'Облако' },
  { name: 'Xbox Game Pass', url: 'https://www.xbox.com/', category: 'Игры' },
  { name: 'Skyeng', url: 'https://skyeng.ru/', category: 'Учёба' },
  { name: 'Figma', url: 'https://www.figma.com/', category: 'Работа' },
  { name: 'Microsoft 365', url: 'https://www.microsoft.com/microsoft-365', category: 'Работа' },
  { name: 'Adobe Creative Cloud', url: 'https://www.adobe.com/', category: 'Работа' },
  { name: 'Discord Nitro', url: 'https://discord.com/', category: 'Связь' },
]
