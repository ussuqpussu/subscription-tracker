import { CURRENCY_SYMBOLS } from '../constants'
import type { Subscription } from '../types'
import { parseISODate } from '../utils/dateUtils'
import { formatDate, pluralize } from '../utils/format'
import { getMonthlyTotalRub, type Rates } from '../utils/rates'
import { countOverdue, isActive } from '../utils/subscriptionUtils'
import { Amount } from './Amount'
import { EyeIcon, EyeOffIcon } from './icons'
import { StatusLamp } from './StatusLamp'
import styles from './SummaryBar.module.css'

interface SummaryBarProps {
  subscriptions: readonly Subscription[]
  today: Date
  rates: Rates | null
  hidden: boolean
  onToggleHidden: () => void
}

/** Главная карточка: траты в месяц по активным подпискам в рублях, годовая сумма и счётчики. */
export function SummaryBar({ subscriptions, today, rates, hidden, onToggleHidden }: SummaryBarProps) {
  const active = subscriptions.filter(isActive)
  const total = getMonthlyTotalRub(subscriptions, rates)
  const overdueCount = countOverdue(subscriptions, today)
  const foreignSymbols = [...new Set(active.filter((item) => item.currency !== 'RUB').map((item) => item.currency))]
    .map((currency) => CURRENCY_SYMBOLS[currency])
    .join(' и ')

  let note: string | null = null
  if (total.missing.length > 0) {
    note = `Без ${total.missing.map((currency) => CURRENCY_SYMBOLS[currency]).join(' и ')}: курс загрузится, когда появится интернет.`
  } else if (total.converted && rates) {
    note = `${foreignSymbols} пересчитаны по курсу ЦБ на ${formatDate(parseISODate(rates.date), today)}.`
  }

  return (
    <section className={`card ${styles.summary}`} aria-labelledby="summary-title">
      <div className={styles.header}>
        <h2 id="summary-title" className={styles.title}>
          Траты в месяц
        </h2>
        <button
          type="button"
          className={`icon-button ${styles.eye}`}
          aria-label="Скрыть суммы"
          aria-pressed={hidden}
          onClick={onToggleHidden}
        >
          {hidden ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>

      {active.length > 0 ? (
        <>
          <p className={`tabular ${styles.total}`}>
            <Amount amount={total.amount} currency="RUB" hidden={hidden} />
          </p>
          <p className={`tabular ${styles.yearly}`}>
            <Amount amount={total.amount * 12} currency="RUB" hidden={hidden} /> в год
          </p>
        </>
      ) : (
        <p className={styles.empty}>Нет активных подписок</p>
      )}

      <div className={styles.pills}>
        <span className="pill">
          {active.length} {pluralize(active.length, ['активная', 'активные', 'активных'])}
        </span>
        {overdueCount > 0 && (
          <span className={`pill ${styles.overdue}`}>
            <StatusLamp lamp="red" size="small" />
            Просрочено: {overdueCount}
          </span>
        )}
      </div>

      {note && <p className={styles.note}>{note}</p>}
    </section>
  )
}
