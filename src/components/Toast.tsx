import { useEffect } from 'react'
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

/** Стеклянная всплывашка над нижней панелью. Регион aria-live есть всегда, чтобы сообщения озвучивались. */
export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(onDismiss, toast.actionLabel ? 6500 : 3800)
    return () => window.clearTimeout(timer)
  }, [toast, onDismiss])

  return (
    <div className={styles.region} role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} className={`glass-thick ${styles.toast}`} data-tone={toast.tone ?? 'default'}>
          <span className={styles.text}>{toast.text}</span>
          {toast.actionLabel && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                toast.onAction?.()
                onDismiss()
              }}
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
