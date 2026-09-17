import { useEffect, useRef, type ReactNode } from 'react'
import styles from './Sheet.module.css'

interface SheetProps {
  open: boolean
  onClose: () => void
  labelledBy: string
  children: ReactNode
  /** sheet — выезжает снизу (на широком экране — по центру); alert — компактное окно подтверждения. */
  variant?: 'sheet' | 'alert'
}

/**
 * Модальное окно на нативном <dialog>: фокус внутри, Esc и тап по фону закрывают.
 * Содержимое монтируется только в открытом состоянии, поэтому форма каждый раз начинается заново.
 */
export function Sheet({ open, onClose, labelledBy, children, variant = 'sheet' }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    // StrictMode вызывает эффект дважды: showModal на уже открытом окне бросает исключение.
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      data-variant={variant}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClose={() => {
        if (open) onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {open ? <div className={`glass-thick ${styles.surface}`}>{children}</div> : null}
    </dialog>
  )
}
