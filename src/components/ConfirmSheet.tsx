import styles from './ConfirmSheet.module.css'
import { Sheet } from './Sheet'

export interface ConfirmRequest {
  title: string
  message?: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
}

interface ConfirmSheetProps {
  request: ConfirmRequest | null
  onClose: () => void
}

/** Подтверждение в стиле iOS alert. Фокус по умолчанию — на безопасной «Отмене». */
export function ConfirmSheet({ request, onClose }: ConfirmSheetProps) {
  return (
    <Sheet open={request !== null} onClose={onClose} labelledBy="confirm-title" variant="alert">
      {request && (
        <div className={styles.body}>
          <div className={styles.text}>
            <h2 id="confirm-title" className={styles.title}>
              {request.title}
            </h2>
            {request.message && <p className={styles.message}>{request.message}</p>}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.button}
              data-tone={request.destructive ? 'destructive' : 'default'}
              onClick={() => {
                onClose()
                request.onConfirm()
              }}
            >
              {request.confirmLabel}
            </button>
            <button type="button" className={styles.button} data-autofocus onClick={onClose}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
