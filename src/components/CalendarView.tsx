import { useMemo, useRef, useState, type PointerEvent } from 'react'
import type { Subscription } from '../types'
import { addMonths, getMonthEvents, getMonthGrid, getMonthTotal, startOfMonth, type CalendarEvent } from '../utils/calendar'
import { compareDates, getDueDate, toISODate } from '../utils/dateUtils'
import { formatDate, formatMoney, formatMonthYear, pluralize } from '../utils/format'
import type { Rates } from '../utils/rates'
import { getLamp } from '../utils/subscriptionUtils'
import styles from './CalendarView.module.css'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from './icons'
import { Logo } from './Logo'
import { StatusLamp } from './StatusLamp'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
/** Столько точек помещается под числом, остальные прячутся под «+N». */
const MAX_DOTS = 3
/** Палец сдвинулся дальше — листаем месяц. */
const SWIPE_DISTANCE = 60

interface CalendarViewProps {
  subscriptions: readonly Subscription[]
  today: Date
  rates: Rates | null
  hidden: boolean
  onOpen: (subscription: Subscription) => void
  onMarkPaid: (subscription: Subscription) => void
}

/** Календарь списаний: месяц в сетке, под ним события выбранного дня. */
export function CalendarView({ subscriptions, today, rates, hidden, onOpen, onMarkPaid }: CalendarViewProps) {
  const [month, setMonth] = useState(() => startOfMonth(today))
  const [selected, setSelected] = useState(() => today)
  const swipeRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null)

  const events = useMemo(() => getMonthEvents(subscriptions, month), [subscriptions, month])
  const grid = useMemo(() => getMonthGrid(month), [month])
  const total = getMonthTotal(events, rates)
  const selectedEvents = events.get(toISODate(selected)) ?? []
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()

  const goToMonth = (shift: number) => {
    const next = addMonths(month, shift)
    setMonth(next)
    // Выделяем первое число нового месяца, а в текущем — сегодня.
    setSelected(next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth() ? today : next)
  }

  const goToToday = () => {
    setMonth(startOfMonth(today))
    setSelected(today)
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    swipeRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY }
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current
    if (!swipe || swipe.pointerId !== event.pointerId) return
    swipeRef.current = null
    const dx = event.clientX - swipe.startX
    const dy = event.clientY - swipe.startY
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy)) return
    goToMonth(dx < 0 ? 1 : -1)
  }

  return (
    <section className={styles.calendar} aria-label="Календарь списаний">
      <header className={`glass ${styles.header}`}>
        <button type="button" className={styles.arrow} aria-label="Предыдущий месяц" onClick={() => goToMonth(-1)}>
          <ChevronLeftIcon />
        </button>
        <h2 className={styles.month}>{formatMonthYear(month)}</h2>
        <button type="button" className={styles.arrow} aria-label="Следующий месяц" onClick={() => goToMonth(1)}>
          <ChevronRightIcon />
        </button>
      </header>

      <div
        className={styles.sheet}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => (swipeRef.current = null)}
      >
        <div className={styles.weekdays} aria-hidden="true">
          {WEEKDAYS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className={styles.grid} role="grid">
          {grid.map((day) => {
            const key = toISODate(day)
            const dayEvents = events.get(key) ?? []
            const outside = day.getMonth() !== month.getMonth()
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                className={styles.day}
                data-outside={outside}
                data-today={compareDates(day, today) === 0}
                data-selected={compareDates(day, selected) === 0}
                aria-label={`${formatDate(day, today)}${dayEvents.length > 0 ? `, событий: ${dayEvents.length}` : ''}`}
                aria-pressed={compareDates(day, selected) === 0}
                onClick={() => setSelected(day)}
              >
                <span className={styles.dayNumber}>{day.getDate()}</span>
                <span className={styles.dots} aria-hidden="true">
                  {dayEvents.slice(0, MAX_DOTS).map((event, index) => (
                    <span
                      key={`${event.subscription.id}:${event.type}:${index}`}
                      className={styles.dot}
                      data-type={event.type}
                      data-lamp={getLamp(event.subscription, today)}
                    />
                  ))}
                  {dayEvents.length > MAX_DOTS && <span className={styles.more}>+{dayEvents.length - MAX_DOTS}</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <p className={styles.total}>
        {total.payments > 0 ? (
          <>
            {total.payments} {pluralize(total.payments, ['платёж', 'платежа', 'платежей'])} ·{' '}
            <span className="tabular">{hidden ? '•••• ₽' : formatMoney(total.amount, 'RUB')}</span> за месяц
          </>
        ) : (
          'В этом месяце списаний нет'
        )}
      </p>

      <section className={styles.dayList} aria-label={`События: ${formatDate(selected, today)}`}>
        <div className={styles.dayHeader}>
          <h3 className={styles.dayTitle}>{formatDate(selected, today)}</h3>
          {!isCurrentMonth && (
            <button type="button" className={`glass ${styles.todayButton}`} onClick={goToToday}>
              Сегодня
            </button>
          )}
        </div>

        {selectedEvents.length === 0 ? (
          <p className={styles.empty}>В этот день ничего не списывается.</p>
        ) : (
          <ul className={`card ${styles.events}`}>
            {selectedEvents.map((event, index) => (
              <EventRow
                key={`${event.subscription.id}:${event.type}:${index}`}
                event={event}
                today={today}
                selected={selected}
                hidden={hidden}
                onOpen={onOpen}
                onMarkPaid={onMarkPaid}
              />
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}

interface EventRowProps {
  event: CalendarEvent
  today: Date
  selected: Date
  hidden: boolean
  onOpen: (subscription: Subscription) => void
  onMarkPaid: (subscription: Subscription) => void
}

function EventRow({ event, today, selected, hidden, onOpen, onMarkPaid }: EventRowProps) {
  const { subscription, type } = event
  // Оплату отмечаем, только если это ближайший неоплаченный платёж и его день наступил.
  const due = getDueDate(subscription)
  const payable =
    type === 'payment' && compareDates(due, selected) === 0 && compareDates(selected, today) <= 0

  return (
    <li className={styles.event}>
      <button type="button" className={styles.eventMain} onClick={() => onOpen(subscription)}>
        <Logo subscription={subscription} className={styles.eventLogo} />
        <span className={styles.eventText}>
          <span className={styles.eventName}>{subscription.name}</span>
          <span className={styles.eventKind}>
            {type === 'trial' ? (
              'конец пробного периода'
            ) : (
              <>
                <StatusLamp lamp={getLamp(subscription, today)} size="small" />
                списание
              </>
            )}
          </span>
        </span>
        <span className={`tabular ${styles.eventAmount}`}>
          {hidden ? '••••' : formatMoney(event.amount, event.currency)}
        </span>
      </button>
      {payable && (
        <button type="button" className={`glass ${styles.pay}`} onClick={() => onMarkPaid(subscription)}>
          <CheckIcon />
          Оплачено
        </button>
      )}
    </li>
  )
}
