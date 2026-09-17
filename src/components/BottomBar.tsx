import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import type { StatusFilter } from '../utils/subscriptionUtils'
import styles from './BottomBar.module.css'
import { ListIcon, PauseCircleIcon, PlayCircleIcon, PlusIcon, XCircleIcon } from './icons'

const TABS: readonly { value: StatusFilter; label: string; icon: ReactNode }[] = [
  { value: 'all', label: 'Все', icon: <ListIcon /> },
  { value: 'active', label: 'Активные', icon: <PlayCircleIcon /> },
  { value: 'paused', label: 'Пауза', icon: <PauseCircleIcon /> },
  { value: 'cancelled', label: 'Отменены', icon: <XCircleIcon /> },
]

/** Внутренний отступ панели — совпадает с padding в CSS. */
const BAR_PADDING = 4
/** Палец сдвинулся дальше — это уже перетаскивание линзы, а не касание. */
const DRAG_THRESHOLD = 6

interface BottomBarProps {
  /** null — панель статусов скрыта (список пуст), остаётся только кнопка «+». */
  status: StatusFilter | null
  onStatusChange: (status: StatusFilter) => void
  onAdd: () => void
}

interface Drag {
  pointerId: number
  startX: number
  active: boolean
}

/**
 * Плавающая стеклянная панель вкладок в духе Telegram: выбранную вкладку подсвечивает
 * стеклянная линза. Линзу можно вести пальцем по панели — вкладка выбирается, когда палец отпущен.
 */
export function BottomBar({ status, onStatusChange, onAdd }: BottomBarProps) {
  const navRef = useRef<HTMLElement>(null)
  const dragRef = useRef<Drag | null>(null)
  // Во время перетаскивания: смещение линзы в px и вкладка под пальцем.
  const [dragPosition, setDragPosition] = useState<{ x: number; index: number } | null>(null)

  const selectedIndex = Math.max(
    0,
    TABS.findIndex((tab) => tab.value === status),
  )
  const highlightedIndex = dragPosition?.index ?? selectedIndex

  const locate = (clientX: number) => {
    const rect = navRef.current!.getBoundingClientRect()
    const tabWidth = (rect.width - BAR_PADDING * 2) / TABS.length
    const local = clientX - rect.left - BAR_PADDING
    return {
      x: Math.min(Math.max(local - tabWidth / 2, 0), tabWidth * (TABS.length - 1)),
      index: Math.min(Math.max(Math.floor(local / tabWidth), 0), TABS.length - 1),
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, active: false }
  }

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (!drag.active) {
      if (Math.abs(event.clientX - drag.startX) < DRAG_THRESHOLD) return
      drag.active = true
      // Захват указателя: дальше события идут панели, а обычный клик по кнопке не сработает.
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    setDragPosition(locate(event.clientX))
  }

  const handlePointerEnd = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (!drag.active) return
    setDragPosition(null)
    if (event.type === 'pointerup') onStatusChange(TABS[locate(event.clientX).index].value)
  }

  const lensStyle = {
    '--count': TABS.length,
    '--index': selectedIndex,
    ...(dragPosition ? { transform: `translateX(${dragPosition.x}px) scale(1.12)` } : {}),
  } as CSSProperties

  return (
    <div className={styles.dock}>
      {status !== null && (
        <nav
          ref={navRef}
          className={`glass ${styles.tabs}`}
          aria-label="Статус подписок"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <span className={styles.lens} data-dragging={dragPosition !== null} style={lensStyle} aria-hidden="true" />
          {TABS.map((tab, index) => (
            <button
              key={tab.value}
              type="button"
              className={styles.tab}
              aria-pressed={status === tab.value}
              data-highlighted={index === highlightedIndex}
              onClick={() => onStatusChange(tab.value)}
            >
              {tab.icon}
              <span className={styles.label}>{tab.label}</span>
            </button>
          ))}
        </nav>
      )}
      <button type="button" className={`glass ${styles.add}`} aria-label="Добавить подписку" onClick={onAdd}>
        <PlusIcon />
      </button>
    </div>
  )
}
