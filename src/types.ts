export type Currency = 'RUB' | 'USD' | 'EUR' | 'KZT'

export type BillingPeriod = 'weekly' | 'monthly' | 'quarterly' | 'biannual' | 'yearly' | 'custom'

export type Status = 'active' | 'paused' | 'cancelled'

/** Цвет лампочки: сколько осталось до платежа. */
export type Lamp = 'green' | 'yellow' | 'red' | 'off'

export interface Subscription {
  id: string
  name: string
  price: number
  currency: Currency
  startDate: string // ISO дата первого/последнего платежа
  billingPeriod: BillingPeriod
  customDays?: number // только если billingPeriod === 'custom'
  category: string
  status: Status
  notes?: string
  reminders: number[] // за сколько дней до платежа напомнить, напр. [1, 3, 7]
  /** ISO дата последнего платежа из расписания, отмеченного как оплаченный. */
  paidThrough?: string
}

/** Поля, которые задают расписание платежей. */
export type Schedule = Pick<Subscription, 'startDate' | 'billingPeriod' | 'customDays'>
