import type { Subscription } from '../types'
import { pluralize } from '../utils/format'
import { countOverdue, getMonthlyTotals, isActive } from '../utils/subscriptionUtils'
import { Amount } from './Amount'
import { EyeIcon, EyeOffIcon } from './icons'
import { StatusLamp } from './StatusLamp'
import styles from './SummaryBar.module.css'

interface SummaryBarProps {
  subscriptions: readonly Subscription[]
  today: Date
  hidden: boolean
  onToggleHidden: () => void
}

/** Главная карточка: траты в месяц по активным подпискам (по валютам) и счётчики. */
export function SummaryBar({ subscriptions, today, hidden, onToggleHidden }: SummaryBarProps) {
  const totals = getMonthlyTotals(subscriptions)
  const activeCount = subscriptions.filter(isActive).length
  const overdueCount = countOverdue(subscriptions, today)

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

      {totals.length > 0 ? (
        <ul className={styles.totals}>
          {totals.map((total) => (
            <li key={total.currency} className={`tabular ${styles.total}`}>
              <Amount amount={total.amount} currency={total.currency} hidden={hidden} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>Нет активных подписок</p>
      )}

      <div className={styles.pills}>
        <span className="pill">
          {activeCount} {pluralize(activeCount, ['активная', 'активные', 'активных'])}
        </span>
        {overdueCount > 0 && (
          <span className={`pill ${styles.overdue}`}>
            <StatusLamp lamp="red" size="small" />
            Просрочено: {overdueCount}
          </span>
        )}
      </div>
    </section>
  )
}
