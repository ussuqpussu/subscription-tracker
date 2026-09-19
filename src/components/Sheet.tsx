import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from 'motion/react'
import { SheetDragHandleContext } from '../hooks/useSheetDragHandle'
import { project, SPRING_DEFAULT, SPRING_DRAWER } from '../motion/springs'
import styles from './Sheet.module.css'

interface SheetProps {
  open: boolean
  onClose: () => void
  labelledBy: string
  children: ReactNode
  /** sheet — выезжает снизу (на широком экране — по центру); alert — компактное окно подтверждения. */
  variant?: 'sheet' | 'alert'
}

/** Насколько нужно утащить sheet вниз (с учётом инерции броска), чтобы он закрылся. */
const DISMISS_THRESHOLD = 140

/**
 * Модальное окно на нативном <dialog>: фокус внутри, Esc и тап по фону закрывают.
 * Анимация входа/выхода и drag-to-dismiss — на motion.div внутри; сам dialog закрывается
 * только после того, как AnimatePresence доиграет exit-переход (onExitComplete).
 * Содержимое монтируется только в открытом состоянии, поэтому форма каждый раз начинается заново.
 */
export function Sheet({ open, onClose, labelledBy, children, variant = 'sheet' }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const openRef = useRef(open)
  const dragControls = useDragControls()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    openRef.current = open
    const dialog = dialogRef.current
    if (!dialog) return
    // StrictMode вызывает эффект дважды: showModal на уже открытом окне бросает исключение.
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
  }, [open])

  const closeDialogIfStillClosed = () => {
    const dialog = dialogRef.current
    if (dialog?.open && !openRef.current) dialog.close()
  }

  const spring = variant === 'sheet' ? SPRING_DRAWER : SPRING_DEFAULT

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const projected = info.offset.y + project(info.velocity.y)
    if (projected > DISMISS_THRESHOLD) onClose()
  }

  const startDrag = (event: ReactPointerEvent) => dragControls.start(event)

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
      <AnimatePresence onExitComplete={closeDialogIfStillClosed}>
        {open && (
          <SheetDragHandleContext.Provider value={startDrag}>
            <motion.div
              className={`glass-thick ${styles.surface}`}
              drag={variant === 'sheet' && !reduceMotion ? 'y' : false}
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.15, bottom: 0.92 }}
              onDragEnd={handleDragEnd}
              initial={variant === 'sheet' ? { y: '100%' } : { opacity: 0, scale: 1.08 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={variant === 'sheet' ? { y: '100%' } : { opacity: 0, scale: 0.94 }}
              transition={spring}
            >
              {children}
            </motion.div>
          </SheetDragHandleContext.Provider>
        )}
      </AnimatePresence>
    </dialog>
  )
}
