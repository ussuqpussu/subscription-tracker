import type { Subscription } from '../types'
import styles from './SubscriptionList.module.css'
import { SubscriptionRow } from './SubscriptionRow'

interface SubscriptionListProps {
  subscriptions: readonly Subscription[]
  today: Date
  onEdit: (subscription: Subscription) => void
  onExport: (subscription: Subscription) => void
  onMarkPaid: (subscription: Subscription) => void
}

export function SubscriptionList({ subscriptions, today, onEdit, onExport, onMarkPaid }: SubscriptionListProps) {
  return (
    <section className={styles.section} aria-labelledby="list-title">
      <div className={styles.header}>
        <h2 id="list-title" className={styles.title}>
          Подписки
        </h2>
        <span className={`tabular ${styles.count}`}>{subscriptions.length}</span>
      </div>
      <ul className={`card ${styles.list}`} aria-labelledby="list-title">
        {subscriptions.map((subscription) => (
          <SubscriptionRow
            key={subscription.id}
            subscription={subscription}
            today={today}
            onEdit={onEdit}
            onExport={onExport}
            onMarkPaid={onMarkPaid}
          />
        ))}
      </ul>
    </section>
  )
}
