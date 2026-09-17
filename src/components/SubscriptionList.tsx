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
    <ul className={styles.list} aria-label="Подписки">
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
  )
}
