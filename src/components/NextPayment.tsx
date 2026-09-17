import type { Subscription } from '../types'
import { getDaysUntil, getDueDate } from '../utils/dateUtils'
import { formatDate, formatDueText, formatMoney } from '../utils/format'
import { getLamp, isActive, sortSubscriptions } from '../utils/subscriptionUtils'
import { Amount } from './Amount'
import { Logo } from './Logo'
import styles from './NextPayment.module.css'
import { StatusLamp } from './StatusLamp'

interface NextPaymentProps {
  subscriptions: readonly Subscription[]
  today: Date
  hidden: boolean
  onOpen: (subscription: Subscription) => void
}

/** Выделенная градиентная карточка: ближайший (или просроченный) платёж. Нажатие открывает подписку. */
export function NextPayment({ subscriptions, today, hidden, onOpen }: NextPaymentProps) {
  const next = sortSubscriptions(subscriptions.filter(isActive), today)[0]
  if (!next) return null

  const dueDate = getDueDate(next)
  const dueText = formatDueText(getDaysUntil(dueDate, today))
  const dateText = formatDate(dueDate, today)
  const label = `Ближайший платёж: ${next.name}, ${hidden ? 'сумма скрыта' : formatMoney(next.price, next.currency)}, ${dueText}, ${dateText}. Открыть`

  return (
    <button type="button" className={styles.card} aria-label={label} onClick={() => onOpen(next)}>
      <span className={styles.header}>
        <span className={styles.title}>Ближайший платёж</span>
        <span className={styles.date}>{dateText}</span>
      </span>
      <span className={styles.body}>
        <Logo subscription={next} className={styles.logo} />
        <span className={styles.text}>
          <span className={styles.name}>{next.name}</span>
          <span className={styles.due}>
            <StatusLamp lamp={getLamp(next, today)} size="small" />
            {dueText}
          </span>
        </span>
        <span className={`tabular ${styles.amount}`}>
          <Amount amount={next.price} currency={next.currency} hidden={hidden} />
        </span>
      </span>
    </button>
  )
}
