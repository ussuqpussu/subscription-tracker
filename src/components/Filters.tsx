import { getInitial } from '../utils/format'
import styles from './Filters.module.css'
import { ListIcon, PlusIcon } from './icons'

interface FiltersProps {
  categories: readonly string[]
  category: string | null
  onCategoryChange: (category: string | null) => void
  onAdd: () => void
}

/** Быстрые действия: круглые аватары категорий-фильтров и пунктирная «+» для новой подписки. */
export function Filters({ categories, category, onCategoryChange, onAdd }: FiltersProps) {
  return (
    <section className={styles.section} aria-labelledby="categories-title">
      <h2 id="categories-title" className={styles.title}>
        Категории
      </h2>
      <div className={styles.row} role="group" aria-labelledby="categories-title">
        <button
          type="button"
          className={styles.item}
          aria-pressed={category === null}
          onClick={() => onCategoryChange(null)}
        >
          <span className={styles.avatar} aria-hidden="true">
            <ListIcon />
          </span>
          <span className={styles.name}>Все</span>
        </button>

        {categories.map((item) => (
          <button
            key={item}
            type="button"
            className={styles.item}
            aria-pressed={category === item}
            onClick={() => onCategoryChange(category === item ? null : item)}
          >
            <span className={styles.avatar} aria-hidden="true">
              {getInitial(item)}
            </span>
            <span className={styles.name}>{item}</span>
          </button>
        ))}

        <button type="button" className={styles.item} onClick={onAdd}>
          <span className={`${styles.avatar} ${styles.add}`} aria-hidden="true">
            <PlusIcon />
          </span>
          <span className={styles.name}>Добавить</span>
        </button>
      </div>
    </section>
  )
}
