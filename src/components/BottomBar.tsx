import type { ReactNode } from 'react'
import type { StatusFilter } from '../utils/subscriptionUtils'
import styles from './BottomBar.module.css'
import { ListIcon, PauseCircleIcon, PlayCircleIcon, PlusIcon, XCircleIcon } from './icons'

const TABS: readonly { value: StatusFilter; label: string; icon: ReactNode }[] = [
  { value: 'all', label: 'Все', icon: <ListIcon /> },
  { value: 'active', label: 'Активные', icon: <PlayCircleIcon /> },
  { value: 'paused', label: 'Пауза', icon: <PauseCircleIcon /> },
  { value: 'cancelled', label: 'Отменены', icon: <XCircleIcon /> },
]

interface BottomBarProps {
  /** null — панель статусов скрыта (список пуст), остаётся только кнопка «+». */
  status: StatusFilter | null
  onStatusChange: (status: StatusFilter) => void
  onAdd: () => void
}

/** Плавающая стеклянная pill-панель статусов и круглая кнопка главного действия. */
export function BottomBar({ status, onStatusChange, onAdd }: BottomBarProps) {
  return (
    <div className={styles.dock}>
      {status !== null && (
        <nav className={`glass ${styles.tabs}`} aria-label="Статус подписок">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={styles.tab}
              aria-pressed={status === tab.value}
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
