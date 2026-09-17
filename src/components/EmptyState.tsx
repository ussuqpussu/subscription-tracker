import styles from './EmptyState.module.css'
import { SearchOffIcon, StackIcon } from './icons'

interface EmptyStateProps {
  variant: 'empty' | 'filtered'
  onAction: () => void
}

const CONTENT = {
  empty: {
    title: 'Пока нет подписок',
    text: 'Добавьте первую — музыку, кино или облако. Лампочка подскажет, когда пора платить.',
    action: 'Добавить подписку',
  },
  filtered: {
    title: 'Ничего не найдено',
    text: 'Под выбранные фильтры не подходит ни одна подписка.',
    action: 'Сбросить фильтры',
  },
} as const

export function EmptyState({ variant, onAction }: EmptyStateProps) {
  const content = CONTENT[variant]
  return (
    <section className={styles.empty} aria-labelledby="empty-title">
      <div className={`card ${styles.icon}`}>{variant === 'empty' ? <StackIcon /> : <SearchOffIcon />}</div>
      <h2 id="empty-title" className={styles.title}>
        {content.title}
      </h2>
      <p className={styles.text}>{content.text}</p>
      <button
        type="button"
        className={`button ${variant === 'empty' ? 'button-primary' : ''} ${styles.action}`}
        onClick={onAction}
      >
        {content.action}
      </button>
    </section>
  )
}
