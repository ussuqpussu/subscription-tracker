import { useRef, type CSSProperties, type KeyboardEvent } from 'react'
import styles from './SegmentedControl.module.css'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  /** Для коротких подписей вроде «₽»: что прочитает скринридер. */
  ariaLabel?: string
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
  ariaLabelledBy?: string
  size?: 'regular' | 'compact'
  className?: string
}

/** Сегментированный переключатель iOS: radiogroup со стрелками и стеклянным бегунком. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  ariaLabelledBy,
  size = 'regular',
  className,
}: SegmentedControlProps<T>) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1
    let next: number
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = selectedIndex === last ? 0 : selectedIndex + 1
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        next = selectedIndex === 0 ? last : selectedIndex - 1
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = last
        break
      default:
        return
    }
    event.preventDefault()
    onChange(options[next].value)
    buttonsRef.current[next]?.focus()
  }

  const style = { '--count': options.length, '--index': selectedIndex } as CSSProperties

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={`${styles.control} ${className ?? ''}`}
      data-size={size}
      style={style}
    >
      <span className={styles.thumb} aria-hidden="true" />
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(element) => {
            buttonsRef.current[index] = element
          }}
          type="button"
          role="radio"
          aria-checked={index === selectedIndex}
          aria-label={option.ariaLabel}
          tabIndex={index === selectedIndex ? 0 : -1}
          className={styles.segment}
          onClick={() => onChange(option.value)}
          onKeyDown={handleKeyDown}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
