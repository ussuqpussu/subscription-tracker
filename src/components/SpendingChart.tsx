import { useId, useMemo, type CSSProperties } from 'react'
import { CURRENCY_SYMBOLS } from '../constants'
import type { Currency, Subscription } from '../types'
import { formatMoney, formatMonthShort, formatMonthYear } from '../utils/format'
import { getPaymentForecast } from '../utils/subscriptionUtils'
import { Amount } from './Amount'
import { ChevronDownIcon } from './icons'
import styles from './SpendingChart.module.css'

const MONTHS = 6

interface SpendingChartProps {
  subscriptions: readonly Subscription[]
  today: Date
  currency: Currency
  /** Валюты активных подписок; выбор валюты появляется, если их больше одной. */
  currencies: readonly Currency[]
  onCurrencyChange: (currency: Currency) => void
  hidden: boolean
}

/** Минимальный столбчатый график платежей на полгода вперёд; текущий месяц — акцентный. */
export function SpendingChart({
  subscriptions,
  today,
  currency,
  currencies,
  onCurrencyChange,
  hidden,
}: SpendingChartProps) {
  const selectId = useId()
  const forecast = useMemo(
    () => getPaymentForecast(subscriptions, currency, today, MONTHS),
    [subscriptions, currency, today],
  )
  const max = Math.max(0, ...forecast.map((item) => item.amount))

  return (
    <section className={`card ${styles.chart}`} aria-labelledby="chart-title">
      <div className={styles.header}>
        <h2 id="chart-title" className={styles.title}>
          Платежи
        </h2>
        {currencies.length > 1 ? (
          <span className={styles.picker}>
            <label htmlFor={selectId} className="visually-hidden">
              Валюта графика
            </label>
            <select
              id={selectId}
              className={styles.select}
              value={currency}
              onChange={(event) => onCurrencyChange(event.target.value as Currency)}
            >
              {currencies.map((item) => (
                <option key={item} value={item}>
                  {CURRENCY_SYMBOLS[item]} {item}
                </option>
              ))}
            </select>
            <ChevronDownIcon />
          </span>
        ) : (
          <span className="pill">{MONTHS} месяцев</span>
        )}
      </div>

      <p className={styles.caption}>В этом месяце</p>
      <p className={`tabular ${styles.current}`}>
        <Amount amount={forecast[0]?.amount ?? 0} currency={currency} hidden={hidden} />
      </p>

      <ol className={styles.bars}>
        {forecast.map((item, index) => (
          <li key={item.month.getTime()} className={styles.column} data-current={index === 0}>
            <span className={styles.track} aria-hidden="true">
              <span
                className={styles.bar}
                data-empty={item.amount === 0}
                style={{ '--ratio': max > 0 ? item.amount / max : 0 } as CSSProperties}
              />
            </span>
            <span className={styles.month} aria-hidden="true">
              {formatMonthShort(item.month)}
            </span>
            <span className="visually-hidden">
              {formatMonthYear(item.month)}: {hidden ? 'сумма скрыта' : formatMoney(item.amount, currency)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
