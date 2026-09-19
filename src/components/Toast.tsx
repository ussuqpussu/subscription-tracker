import { useEffect, useRef, useState } from 'react'
import styles from './Toast.module.css'

export interface ToastMessage {
  id: number
  text: string
  tone?: 'default' | 'error'
  actionLabel?: string
  onAction?: () => void
}

interface ToastProps {
  toast: ToastMessage | null
  onDismiss: () => void
}

/** Длительность keyframes toast-out в Toast.module.css — размонтируем ровно когда она доиграет. */
const EXIT_DURATION = 200

/** Стеклянная всплывашка над нижней панелью. Регион aria-live есть всегда, чтобы сообщения озвучивались. */
export function Toast({ toast, onDismiss }: ToastProps) {
  // Держим последний тост на экране во время exit-анимации — App уже обнулил toast к этому моменту.
  const [displayed, setDisplayed] = useState<ToastMessage | null>(null)
  const [closing, setClosing] = useState(false)
  const exitTimerRef = useRef<number>(undefined)

  useEffect(() => {
    window.clearTimeout(exitTimerRef.current)
    if (toast) {
      setDisplayed(toast)
      setClosing(false)
    } else if (displayed) {
      setClosing(true)
      exitTimerRef.current = window.setTimeout(() => setDisplayed(null), EXIT_DURATION)
    }
    // displayed нарочно не в зависимостях: реагируем только на смену toast, а не на свой же setDisplayed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast])

  useEffect(() => () => window.clearTimeout(exitTimerRef.current), [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(onDismiss, toast.actionLabel ? 6500 : 3800)
    return () => window.clearTimeout(timer)
  }, [toast, onDismiss])

  return (
    <div className={styles.region} role="status" aria-live="polite">
      {displayed && (
        <div
          key={displayed.id}
          className={`glass-thick ${styles.toast}`}
          data-tone={displayed.tone ?? 'default'}
          data-state={closing ? 'closing' : 'open'}
        >
          <span className={styles.text}>{displayed.text}</span>
          {displayed.actionLabel && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                displayed.onAction?.()
                onDismiss()
              }}
            >
              {displayed.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
