import type { Subscription } from '../types'
import { getDaysUntil, getDueDate } from '../utils/dateUtils'
import { formatDate, formatDueText, formatMoney, formatPeriod, formatStatus, getInitial } from '../utils/format'
import { getLamp } from '../utils/subscriptionUtils'
import { CalendarPlusIcon, CheckIcon } from './icons'
import { StatusLamp } from './StatusLamp'
import styles from './SubscriptionRow.module.css'

interface SubscriptionRowProps {
  subscription: Subscription
  today: Date
  onEdit: (subscription: Subscription) => void
  onExport: (subscription: Subscription) => void
  onMarkPaid: (subscription: Subscription) => void
}

export function SubscriptionRow({ subscription, today, onEdit, onExport, onMarkPaid }: SubscriptionRowProps) {
  const lamp = getLamp(subscription, today)
  const active = subscription.status === 'active'
  const dueDate = getDueDate(subscription)
  const dueText = active ? formatDueText(getDaysUntil(dueDate, today)) : formatStatus(subscription)
  const dateText = formatDate(dueDate, today)
  const price = formatMoney(subscription.price, subscription.currency)
  const period = formatPeriod(subscription).toLowerCase()
  const needsPayment = lamp === 'yellow' || lamp === 'red'

  const label = [
    subscription.name,
    subscription.category,
    `${price}, ${period}`,
    active ? `${dueText}, ${dateText}` : dueText,
    'изменить',
  ]
    .filter(Boolean)
    .join('. ')

  return (
    <li className={styles.row} data-lamp={lamp}>
      <button type="button" className={styles.main} aria-label={label} onClick={() => onEdit(subscription)}>
        <span className={styles.tile} aria-hidden="true">
          {getInitial(subscription.name)}
        </span>
        <span className={styles.text}>
          <span className={styles.name}>{subscription.name}</span>
          <span className={styles.due}>
            <StatusLamp lamp={lamp} />
            <span className={styles.dueText}>{dueText}</span>
          </span>
          {(active || subscription.category) && (
            <span className={styles.meta}>
              {[active ? dateText : '', subscription.category].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
        <span className={styles.money}>
          <span className={`tabular ${styles.price}`}>{price}</span>
          <span className={styles.period}>{period}</span>
        </span>
      </button>

      <button
        type="button"
        className={`icon-button ${styles.export}`}
        aria-label={`Добавить «${subscription.name}» в календарь`}
        onClick={() => onExport(subscription)}
      >
        <CalendarPlusIcon />
      </button>

      {needsPayment && (
        <div className={styles.payRow}>
          <button type="button" className={`glass ${styles.pay}`} onClick={() => onMarkPaid(subscription)}>
            <CheckIcon />
            Оплачено
          </button>
        </div>
      )}
    </li>
  )
}
