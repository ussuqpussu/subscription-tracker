import { AnimatePresence, motion } from 'motion/react'
import { SPRING_DEFAULT } from '../motion/springs'
import type { Subscription } from '../types'
import { getDaysUntil, getDueDate } from '../utils/dateUtils'
import { formatDate, formatDueText, formatMoney, formatPeriod, formatStatus } from '../utils/format'
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
        <span className={styles.lamp}>
          <StatusLamp lamp={lamp} />
        </span>
        <span className={styles.text}>
          <span className={styles.name}>{subscription.name}</span>
          {subscription.category && <span className={styles.category}>{subscription.category}</span>}
          <span className={styles.due}>
            <span className={styles.dueText}>{dueText}</span>
            {active && <span className={styles.date}>{dateText}</span>}
          </span>
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

      <AnimatePresence initial={false}>
        {needsPayment && (
          <motion.div
            className={styles.payRow}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING_DEFAULT}
          >
            <button type="button" className={`glass ${styles.pay}`} onClick={() => onMarkPaid(subscription)}>
              <CheckIcon />
              Оплачено
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}
