import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import styles from './BottomBar.module.css'
import { CalendarIcon, ChartIcon, ListIcon, PlusIcon } from './icons'

export type AppTab = 'home' | 'stats' | 'calendar'

const TABS: readonly { value: AppTab; label: string; icon: ReactNode }[] = [
  { value: 'home', label: 'Главная', icon: <ListIcon /> },
  { value: 'stats', label: 'Статистика', icon: <ChartIcon /> },
  { value: 'calendar', label: 'Календарь', icon: <CalendarIcon /> },
]

/** Внутренний отступ панели — совпадает с padding в CSS. */
const BAR_PADDING = 4
/** Палец сдвинулся дальше — это перетаскивание линзы, а не касание. */
const DRAG_THRESHOLD = 6

interface BottomBarProps {
  /** null — разделы скрыты (список пуст), остаётся только кнопка «+». */
  tab: AppTab | null
  onTabChange: (tab: AppTab) => void
  onAdd: () => void
}

interface Drag {
  pointerId: number
  startX: number
  active: boolean
}

/**
 * Плавающая стеклянная панель разделов в духе Telegram: выбранный раздел подсвечивает
 * стеклянная линза, её можно вести пальцем. Справа — кнопка добавления подписки.
 */
export function BottomBar({ tab, onTabChange, onAdd }: BottomBarProps) {
  const navRef = useRef<HTMLElement>(null)
  const dragRef = useRef<Drag | null>(null)
  // Во время перетаскивания: смещение линзы в px и раздел под пальцем.
  const [dragPosition, setDragPosition] = useState<{ x: number; index: number } | null>(null)

  const selectedIndex = Math.max(
    0,
    TABS.findIndex((item) => item.value === tab),
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
    if (event.type === 'pointerup') onTabChange(TABS[locate(event.clientX).index].value)
  }

  const lensStyle = {
    '--count': TABS.length,
    '--index': selectedIndex,
    ...(dragPosition ? { transform: `translateX(${dragPosition.x}px) scale(1.12)` } : {}),
  } as CSSProperties

  return (
    <div className={styles.dock}>
      {tab !== null && (
        <nav
          ref={navRef}
          className={`glass ${styles.tabs}`}
          aria-label="Разделы"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <span className={styles.lens} data-dragging={dragPosition !== null} style={lensStyle} aria-hidden="true" />
          {TABS.map((item, index) => (
            <button
              key={item.value}
              type="button"
              className={styles.tab}
              aria-pressed={tab === item.value}
              data-highlighted={index === highlightedIndex}
              onClick={() => onTabChange(item.value)}
            >
              {item.icon}
              <span className={styles.label}>{item.label}</span>
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
