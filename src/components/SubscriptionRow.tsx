import { useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import type { Subscription } from '../types'
import { getDaysUntil, getDueDate } from '../utils/dateUtils'
import { formatDate, formatDueText, formatMoney, formatPeriod, formatStatus } from '../utils/format'
import { getLamp } from '../utils/subscriptionUtils'
import { CalendarPlusIcon, CheckIcon, TrashIcon } from './icons'
import { Logo } from './Logo'
import { StatusLamp } from './StatusLamp'
import styles from './SubscriptionRow.module.css'

interface SubscriptionRowProps {
  subscription: Subscription
  today: Date
  onEdit: (subscription: Subscription) => void
  onExport: (subscription: Subscription) => void
  onMarkPaid: (subscription: Subscription) => void
  onDelete: (subscription: Subscription) => void
}

/** Ширина открытой кнопки действия — совпадает с CSS. */
const REVEAL_WIDTH = 80
/** Палец сдвинулся по горизонтали дальше — это свайп, а не касание или прокрутка. */
const DRAG_START = 10
/** Протянули дальше этой доли ширины строки — сразу спрашиваем об удалении. */
const FULL_SWIPE = 0.6

interface Drag {
  pointerId: number
  startX: number
  startY: number
  base: number
  offset: number
  active: boolean
}

export function SubscriptionRow({
  subscription,
  today,
  onEdit,
  onExport,
  onMarkPaid,
  onDelete,
}: SubscriptionRowProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const suppressClickRef = useRef(false)
  /** Какое действие открыто свайпом: удаление справа или отметка оплаты слева. */
  const [revealed, setRevealed] = useState<'none' | 'delete' | 'paid'>('none')

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

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    suppressClickRef.current = false
    // Влево — удаление (смещение отрицательное), вправо — отметка оплаты.
    const base = revealed === 'delete' ? -REVEAL_WIDTH : revealed === 'paid' ? REVEAL_WIDTH : 0
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      base,
      offset: base,
      active: false,
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const content = contentRef.current
    if (!drag || !content || drag.pointerId !== event.pointerId) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.active) {
      // Вертикальное движение — это прокрутка списка: свайп не начинаем.
      if (Math.abs(dy) > DRAG_START && Math.abs(dy) > Math.abs(dx)) {
        dragRef.current = null
        return
      }
      if (Math.abs(dx) < DRAG_START) return
      drag.active = true
      content.setPointerCapture(event.pointerId)
      content.dataset.dragging = 'true'
    }
    // Вправо строка тянется, только если платёж можно отметить оплаченным.
    const offset = drag.base + dx
    drag.offset = needsPayment ? offset : Math.min(0, offset)
    // Показываем кнопку той стороны, в которую тянут.
    content.dataset.direction = drag.offset < 0 ? 'delete' : 'paid'
    content.style.transform = `translateX(${drag.offset}px)`
  }

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const content = contentRef.current
    if (!drag || !content || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (!drag.active) return
    // После свайпа браузер может прислать click: он не должен открывать подписку.
    suppressClickRef.current = true
    delete content.dataset.dragging
    delete content.dataset.direction
    content.style.transform = ''
    const distance = Math.abs(drag.offset)
    const action = drag.offset < 0 ? 'delete' : 'paid'
    const fullSwipe = event.type === 'pointerup' && distance > content.offsetWidth * FULL_SWIPE
    setRevealed(!fullSwipe && distance > REVEAL_WIDTH / 2 ? action : 'none')
    if (!fullSwipe) return
    if (action === 'delete') onDelete(subscription)
    else onMarkPaid(subscription)
  }

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      event.preventDefault()
      event.stopPropagation()
      suppressClickRef.current = false
    } else if (revealed !== 'none') {
      // Касание по открытой строке закрывает действие, а не открывает подписку.
      event.preventDefault()
      event.stopPropagation()
      setRevealed('none')
    }
  }

  return (
    <li className={styles.row} data-lamp={lamp}>
      {needsPayment && (
        <button
          type="button"
          className={styles.payAction}
          aria-label={`Отметить «${subscription.name}» оплаченной`}
          tabIndex={revealed === 'paid' ? 0 : -1}
          aria-hidden={revealed !== 'paid'}
          onClick={() => {
            setRevealed('none')
            onMarkPaid(subscription)
          }}
        >
          <CheckIcon />
        </button>
      )}

      <button
        type="button"
        className={styles.deleteAction}
        aria-label={`Удалить «${subscription.name}»`}
        tabIndex={revealed === 'delete' ? 0 : -1}
        aria-hidden={revealed !== 'delete'}
        onClick={() => {
          setRevealed('none')
          onDelete(subscription)
        }}
      >
        <TrashIcon />
      </button>

      <div
        ref={contentRef}
        className={styles.content}
        data-revealed={revealed === 'none' ? undefined : revealed}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClickCapture={handleClickCapture}
      >
        <button type="button" className={styles.main} aria-label={label} onClick={() => onEdit(subscription)}>
          <Logo subscription={subscription} className={styles.tile} />
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
      </div>
    </li>
  )
}
