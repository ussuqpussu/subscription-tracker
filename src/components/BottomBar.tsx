import styles from './BottomBar.module.css'
import { PlusIcon } from './icons'

interface BottomBarProps {
  onAdd: () => void
}

/** Плавающая стеклянная капсула с главным действием — единственный акцент интерфейса. */
export function BottomBar({ onAdd }: BottomBarProps) {
  return (
    <div className={styles.dock}>
      <div className={`glass ${styles.capsule}`}>
        <button type="button" className={styles.add} onClick={onAdd}>
          <PlusIcon />
          Добавить
        </button>
      </div>
    </div>
  )
}
