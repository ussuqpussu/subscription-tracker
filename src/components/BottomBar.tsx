import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { tapHaptic } from '../utils/haptics'
import { animateSpring, MOVE_SPRING } from '../utils/spring'
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
 *
 * Во время жеста и на снэпе после отпускания transform линзы задаётся императивно (ref),
 * а не через React style — иначе перерисовки родителя перебивали бы кадры пружины.
 * В состоянии покоя (нет ни жеста, ни бегущей пружины) transform снова отдаётся CSS
 * (`--index` в lensStyle) — так простой тап по вкладке тоже плавно едет с пружиной.
 */
export function BottomBar({ tab, onTabChange, onAdd }: BottomBarProps) {
  const navRef = useRef<HTMLElement>(null)
  const lensRef = useRef<HTMLSpanElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const cancelSpringRef = useRef<(() => void) | null>(null)
  // Только для подсветки вкладки под пальцем во время жеста — сама линза едет мимо React.
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const selectedIndex = Math.max(
    0,
    TABS.findIndex((item) => item.value === tab),
  )
  const highlightedIndex = dragIndex ?? selectedIndex

  /** Смена раздела отзывается лёгким щелчком, как перелистывание в нативных приложениях. */
  const selectTab = (next: AppTab) => {
    if (next !== tab) tapHaptic()
    onTabChange(next)
  }

  const tabWidth = () => {
    const rect = navRef.current!.getBoundingClientRect()
    return (rect.width - BAR_PADDING * 2) / TABS.length
  }

  const locate = (clientX: number) => {
    const rect = navRef.current!.getBoundingClientRect()
    const width = tabWidth()
    const local = clientX - rect.left - BAR_PADDING
    return {
      x: Math.min(Math.max(local - width / 2, 0), width * (TABS.length - 1)),
      index: Math.min(Math.max(Math.floor(local / width), 0), TABS.length - 1),
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    cancelSpringRef.current?.()
    cancelSpringRef.current = null
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, active: false }
  }

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    const lens = lensRef.current
    if (!drag || !lens || drag.pointerId !== event.pointerId) return
    if (!drag.active) {
      if (Math.abs(event.clientX - drag.startX) < DRAG_THRESHOLD) return
      drag.active = true
      // Захват указателя: дальше события идут панели, а обычный клик по кнопке не сработает.
      event.currentTarget.setPointerCapture(event.pointerId)
      lens.dataset.dragging = 'true'
    }
    const { x, index } = locate(event.clientX)
    lens.style.transform = `translateX(${x}px) scale(1.12)`
    setDragIndex(index)
  }

  const handlePointerEnd = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    const lens = lensRef.current
    if (!drag || !lens || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (!drag.active) return
    const { x: fromX, index } = locate(event.clientX)
    // Тап выбирает вкладку под пальцем; pointercancel возвращает линзу туда, где она была.
    const finalIndex = event.type === 'pointerup' ? index : selectedIndex
    if (event.type === 'pointerup') selectTab(TABS[index].value)
    cancelSpringRef.current = animateSpring({
      from: fromX,
      to: finalIndex * tabWidth(),
      ...MOVE_SPRING,
      onUpdate: (value) => {
        lens.style.transform = `translateX(${value}px) scale(1)`
      },
      onDone: () => {
        cancelSpringRef.current = null
        delete lens.dataset.dragging
        lens.style.transform = ''
        setDragIndex(null)
      },
    })
  }

  const lensStyle = { '--count': TABS.length, '--index': selectedIndex } as CSSProperties

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
          <span ref={lensRef} className={styles.lens} style={lensStyle} aria-hidden="true" />
          {TABS.map((item, index) => (
            <button
              key={item.value}
              type="button"
              className={styles.tab}
              aria-pressed={tab === item.value}
              data-highlighted={index === highlightedIndex}
              onClick={() => selectTab(item.value)}
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
