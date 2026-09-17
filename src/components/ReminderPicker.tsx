import { useId, useState } from 'react'
import { MAX_REMINDER_DAYS, REMINDER_PRESETS } from '../constants'
import { formatDays, formatReminderList } from '../utils/format'
import { isValidReminder, normalizeReminders } from '../utils/subscriptionSchema'
import { XIcon } from './icons'
import styles from './ReminderPicker.module.css'

interface ReminderPickerProps {
  value: readonly number[]
  onChange: (value: number[]) => void
  labelledBy: string
}

/** Чипы-пресеты (можно выбрать несколько) и поле для своего числа дней. */
export function ReminderPicker({ value, onChange, labelledBy }: ReminderPickerProps) {
  const [customValue, setCustomValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()
  const errorId = useId()

  const customDays = value.filter((days) => !REMINDER_PRESETS.includes(days))

  const toggle = (days: number) => {
    onChange(value.includes(days) ? value.filter((item) => item !== days) : normalizeReminders([...value, days]))
  }

  const addCustom = () => {
    const days = Number(customValue.trim())
    if (!isValidReminder(days)) {
      setError(`Целое число дней от 1 до ${MAX_REMINDER_DAYS}.`)
      return
    }
    onChange(normalizeReminders([...value, days]))
    setCustomValue('')
    setError(null)
  }

  return (
    <div className={styles.picker} role="group" aria-labelledby={labelledBy}>
      <div className={styles.chips}>
        {REMINDER_PRESETS.map((days) => (
          <button
            key={days}
            type="button"
            className="chip"
            aria-pressed={value.includes(days)}
            onClick={() => toggle(days)}
          >
            {formatDays(days)}
          </button>
        ))}
        {customDays.map((days) => (
          <button
            key={days}
            type="button"
            className={`chip ${styles.custom}`}
            aria-pressed="true"
            aria-label={`Убрать напоминание за ${formatDays(days)}`}
            onClick={() => toggle(days)}
          >
            {formatDays(days)}
            <XIcon />
          </button>
        ))}
      </div>

      <div className={styles.customRow}>
        <label htmlFor={inputId} className="visually-hidden">
          Своё число дней до платежа
        </label>
        <input
          id={inputId}
          className={styles.input}
          inputMode="numeric"
          enterKeyHint="done"
          autoComplete="off"
          placeholder="Своё число дней"
          value={customValue}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setCustomValue(event.target.value.replace(/\D/g, '').slice(0, 3))
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addCustom()
            }
          }}
        />
        <button type="button" className={styles.add} disabled={customValue === ''} onClick={addCustom}>
          Добавить
        </button>
      </div>
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}

      <p className={styles.summary}>
        {value.length > 0 ? `Напомнить за ${formatReminderList(value)} до платежа` : 'Без напоминаний'}
      </p>
    </div>
  )
}
