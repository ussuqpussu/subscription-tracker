import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react'
import { animateSpring, DRAWER_SPRING, rubberband } from '../utils/spring'
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
  /** Высота окна на старте жеста — граница резины вверх и цель для translateY при закрытии. */
  height: number
  /** Последнее фактически отрисованное смещение (после резины) — точка старта пружины на отпускании. */
  translate: number
  /** Где окно было, когда за него схватились (обычно 0; не 0 — если схватили во время бега пружины). */
  baseline: number
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
  const cancelSpringRef = useRef<(() => void) | null>(null)
  const currentTranslateRef = useRef(0)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    // StrictMode вызывает эффект дважды: showModal на уже открытом окне бросает исключение.
    if (open && !dialog.open) {
      currentTranslateRef.current = 0
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
    cancelSpringRef.current?.()
    cancelSpringRef.current = null
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
      height: surface.offsetHeight,
      translate: currentTranslateRef.current,
      baseline: currentTranslateRef.current,
    }
    surface.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const surface = surfaceRef.current
    if (!drag || !surface || drag.pointerId !== event.pointerId) return
    const offset = drag.baseline + (event.clientY - drag.startY)
    const elapsed = Math.max(1, event.timeStamp - drag.lastTime)
    drag.velocity = (event.clientY - drag.lastY) / elapsed
    drag.lastY = event.clientY
    drag.lastTime = event.timeStamp
    // Вверх — резина у границы (§9). Вниз — 1:1, это и есть жест закрытия (§2).
    drag.translate = offset > 0 ? offset : -rubberband(-offset, drag.height)
    currentTranslateRef.current = drag.translate
    surface.style.transform = `translateY(${drag.translate}px)`
  }

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const surface = surfaceRef.current
    if (!drag || !surface || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    const offset = drag.baseline + (event.clientY - drag.startY)
    const dismiss =
      event.type !== 'pointercancel' &&
      (offset > DISMISS_DISTANCE || (offset > 24 && drag.velocity > DISMISS_VELOCITY))
    const velocity = drag.velocity * 1000 // px/мс → px/с
    cancelSpringRef.current = animateSpring({
      from: drag.translate,
      to: dismiss ? drag.height : 0,
      velocity,
      ...DRAWER_SPRING,
      onUpdate: (value) => {
        currentTranslateRef.current = value
        surface.style.transform = `translateY(${value}px)`
      },
      onDone: () => {
        cancelSpringRef.current = null
        if (dismiss) onClose()
        else surface.style.transform = ''
      },
    })
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
