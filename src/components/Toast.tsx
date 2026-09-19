import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SPRING_DEFAULT } from '../motion/springs'
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
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className={`glass-thick ${styles.toast}`}
            data-tone={toast.tone ?? 'default'}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={SPRING_DEFAULT}
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
