import type { Currency, Subscription } from '../types'
import { formatDueText } from '../utils/format'
import { getDaysLeft, getLamp, getMonthlyTotals, isActive, sortSubscriptions } from '../utils/subscriptionUtils'
import { Amount } from './Amount'
import { StatusLamp } from './StatusLamp'
import styles from './StatTiles.module.css'

interface StatTilesProps {
  subscriptions: readonly Subscription[]
  today: Date
  /** Валюта годовой суммы — та же, что выбрана в графике. */
  currency: Currency
  hidden: boolean
}

/** Две выделенные метрики на градиентных плитках. */
export function StatTiles({ subscriptions, today, currency, hidden }: StatTilesProps) {
  const next = sortSubscriptions(subscriptions.filter(isActive), today)[0]
  const monthly = getMonthlyTotals(subscriptions).find((total) => total.currency === currency)?.amount ?? 0

  return (
    <div className={styles.tiles}>
      <section className={styles.tile} data-tone="violet" aria-labelledby="tile-next-title">
        <h2 id="tile-next-title" className={styles.label}>
          Ближайший платёж
        </h2>
        {next ? (
          <>
            <p className={`tabular ${styles.value}`}>
              <Amount amount={next.price} currency={next.currency} hidden={hidden} />
            </p>
            <p className={styles.caption}>
              <StatusLamp lamp={getLamp(next, today)} size="small" />
              <span className={styles.captionText}>
                {next.name}, {formatDueText(getDaysLeft(next, today))}
              </span>
            </p>
          </>
        ) : (
          <p className={styles.caption}>Нет активных подписок</p>
        )}
      </section>

      <section className={styles.tile} data-tone="coral" aria-labelledby="tile-year-title">
        <h2 id="tile-year-title" className={styles.label}>
          В год
        </h2>
        <p className={`tabular ${styles.value}`}>
          <Amount amount={monthly * 12} currency={currency} hidden={hidden} />
        </p>
        <p className={styles.caption}>
          <span className={styles.captionText}>по активным подпискам</span>
        </p>
      </section>
    </div>
  )
}
