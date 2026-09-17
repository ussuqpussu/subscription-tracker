import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { EllipsisIcon } from './icons'
import styles from './MoreMenu.module.css'

export interface MenuItem {
  id: string
  label: string
  icon: ReactNode
  destructive?: boolean
  disabled?: boolean
  /** Вызывается прямо в обработчике клика: share и выбор файла требуют жеста пользователя. */
  onSelect: () => void
}

interface MoreMenuProps {
  items: readonly MenuItem[]
}

export function MoreMenu({ items }: MoreMenuProps) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const menu = menuRef.current
    menu?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menu?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false)
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
    )
    if (enabled.length === 0) return
    const current = enabled.indexOf(document.activeElement as HTMLButtonElement)
    let next: number
    if (event.key === 'ArrowDown') next = current === enabled.length - 1 ? 0 : current + 1
    else if (event.key === 'ArrowUp') next = current <= 0 ? enabled.length - 1 : current - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = enabled.length - 1
    else if (event.key === 'Tab') {
      setOpen(false)
      return
    } else return
    event.preventDefault()
    enabled[next].focus()
  }

  return (
    <div className={styles.wrapper}>
      <button
        ref={triggerRef}
        type="button"
        className={`glass ${styles.trigger}`}
        aria-label="Ещё"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <EllipsisIcon />
      </button>

      {open && (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label="Действия"
          className={`glass-thick ${styles.menu}`}
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={styles.item}
              data-destructive={item.destructive ? 'true' : undefined}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false)
                triggerRef.current?.focus()
                item.onSelect()
              }}
            >
              <span className={styles.label}>{item.label}</span>
              <span className={styles.icon}>{item.icon}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
