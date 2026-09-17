import type { StatusFilter } from '../utils/subscriptionUtils'
import styles from './Filters.module.css'
import { SegmentedControl, type SegmentOption } from './SegmentedControl'

const STATUS_OPTIONS: readonly SegmentOption<StatusFilter>[] = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'paused', label: 'На паузе' },
  { value: 'cancelled', label: 'Отменены' },
]

interface FiltersProps {
  status: StatusFilter
  onStatusChange: (status: StatusFilter) => void
  categories: readonly string[]
  category: string | null
  onCategoryChange: (category: string | null) => void
}

export function Filters({ status, onStatusChange, categories, category, onCategoryChange }: FiltersProps) {
  return (
    <div className={styles.filters}>
      <SegmentedControl
        className="glass"
        ariaLabel="Статус подписки"
        options={STATUS_OPTIONS}
        value={status}
        onChange={onStatusChange}
      />
      {categories.length > 0 && (
        <div className={styles.chips} role="group" aria-label="Категория">
          <button
            type="button"
            className="chip"
            aria-pressed={category === null}
            onClick={() => onCategoryChange(null)}
          >
            Все категории
          </button>
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              className="chip"
              aria-pressed={category === item}
              onClick={() => onCategoryChange(category === item ? null : item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
