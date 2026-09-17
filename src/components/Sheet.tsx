import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react'
import styles from './Sheet.module.css'

interface SheetProps {
  open: boolean
  onClose: () => void
  labelledBy: string
  children: ReactNode
  /** sheet — выезжает снизу (на широком экране — по центру); alert — компактное окно подтверждения. */
  variant?: 'sheet' | 'alert'
}

/** Сдвиг вниз, после которого отпущенное окно закрывается. */
const DISMISS_DISTANCE = 120
/** Быстрый рывок вниз закрывает окно и на коротком расстоянии (px/мс). */
const DISMISS_VELOCITY = 0.5
const INTERACTIVE = 'button, a, input, select, textarea, label'

interface Drag {
  pointerId: number
  startY: number
  lastY: number
  lastTime: number
  velocity: number
}

/**
 * Модальное окно на нативном <dialog>: фокус внутри, Esc и тап по фону закрывают.
 * Окно типа sheet можно смахнуть вниз за полоску сверху или за шапку с атрибутом data-sheet-drag.
 * Содержимое монтируется только в открытом состоянии, поэтому форма каждый раз начинается заново.
 */
export function Sheet({ open, onClose, labelledBy, children, variant = 'sheet' }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)

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

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const surface = surfaceRef.current
    const target = event.target as HTMLElement
    if (variant !== 'sheet' || !surface || event.button !== 0) return
    if (!target.closest('[data-sheet-grabber], [data-sheet-drag]') || target.closest(INTERACTIVE)) return
    // Иначе мышь при перетаскивании выделяет текст страницы.
    event.preventDefault()
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
    }
    surface.setPointerCapture(event.pointerId)
    surface.dataset.dragging = 'true'
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const surface = surfaceRef.current
    if (!drag || !surface || drag.pointerId !== event.pointerId) return
    const offset = event.clientY - drag.startY
    const elapsed = Math.max(1, event.timeStamp - drag.lastTime)
    drag.velocity = (event.clientY - drag.lastY) / elapsed
    drag.lastY = event.clientY
    drag.lastTime = event.timeStamp
    // Вверх окно почти не тянется — упругое сопротивление, как в iOS.
    const translate = offset > 0 ? offset : -Math.sqrt(-offset) * 2
    surface.style.transform = `translateY(${translate}px)`
  }

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const surface = surfaceRef.current
    if (!drag || !surface || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    delete surface.dataset.dragging
    const offset = event.clientY - drag.startY
    const dismiss = offset > DISMISS_DISTANCE || (offset > 24 && drag.velocity > DISMISS_VELOCITY)
    if (!dismiss || event.type === 'pointercancel') {
      surface.style.transform = ''
      return
    }
    surface.style.transform = 'translateY(100%)'
    let closed = false
    const finish = () => {
      if (closed) return
      closed = true
      onClose()
    }
    surface.addEventListener('transitionend', finish, { once: true })
    window.setTimeout(finish, 320)
  }

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
      {open ? (
        <div
          ref={surfaceRef}
          className={`glass-thick ${styles.surface}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          {variant === 'sheet' && <span className={styles.grabber} data-sheet-grabber aria-hidden="true" />}
          {children}
        </div>
      ) : null}
    </dialog>
  )
}
