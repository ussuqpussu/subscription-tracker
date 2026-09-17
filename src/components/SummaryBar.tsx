import type { Subscription } from '../types'
import { formatMoney, pluralize } from '../utils/format'
import { countOverdue, getMonthlyTotals, isActive } from '../utils/subscriptionUtils'
import { StatusLamp } from './StatusLamp'
import styles from './SummaryBar.module.css'

interface SummaryBarProps {
  subscriptions: readonly Subscription[]
  today: Date
}

/** Траты в месяц по активным подпискам (по валютам) и счётчики. */
export function SummaryBar({ subscriptions, today }: SummaryBarProps) {
  const totals = getMonthlyTotals(subscriptions)
  const activeCount = subscriptions.filter(isActive).length
  const overdueCount = countOverdue(subscriptions, today)

  return (
    <section className={`glass ${styles.summary}`} aria-labelledby="summary-title">
      <div className={styles.header}>
        <h2 id="summary-title" className={styles.title}>
          В месяц
        </h2>
        <p className={styles.count}>
          {activeCount} {pluralize(activeCount, ['активная', 'активные', 'активных'])}
        </p>
      </div>

      {totals.length > 0 ? (
        <ul className={styles.totals}>
          {totals.map((total) => (
            <li key={total.currency} className={`tabular ${styles.total}`}>
              {formatMoney(total.amount, total.currency)}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>Нет активных подписок</p>
      )}

      {overdueCount > 0 && (
        <p className={styles.overdue}>
          <StatusLamp lamp="red" size="small" />
          Просрочено: {overdueCount}
        </p>
      )}
    </section>
  )
}
