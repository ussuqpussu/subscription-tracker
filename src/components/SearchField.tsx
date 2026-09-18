import { useId } from 'react'
import { SearchIcon, XIcon } from './icons'
import styles from './SearchField.module.css'

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  /** Что ищем: подписки на главной или готовые сервисы в форме. */
  label?: string
  placeholder?: string
}

/** Поиск по подпискам: по названию, категории и заметкам. */
export function SearchField({ value, onChange, label = 'Поиск по подпискам', placeholder = 'Поиск' }: SearchFieldProps) {
  const inputId = useId()

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className="visually-hidden">
        {label}
      </label>
      <SearchIcon className={styles.icon} />
      <input
        id={inputId}
        type="search"
        className={styles.input}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value !== '' && (
        <button type="button" className={styles.clear} aria-label="Очистить поиск" onClick={() => onChange('')}>
          <XIcon />
        </button>
      )}
    </div>
  )
}
