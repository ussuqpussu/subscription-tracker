import { useEffect, useRef, useState } from 'react'
import { BellIcon } from './icons'
import { MoreMenu, type MenuItem } from './MoreMenu'
import styles from './NavBar.module.css'

interface NavBarProps {
  title: string
  menuItems: readonly MenuItem[]
  onBellClick: () => void
}

/**
 * Верхняя панель: аватар-меню слева, заголовок, колокольчик справа.
 * При прокрутке под панелью проявляется стеклянная подложка.
 */
export function NavBar({ title, menuItems, onBellClick }: NavBarProps) {
  const [scrolled, setScrolled] = useState(false)
  const barRef = useRef<HTMLElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || typeof IntersectionObserver === 'undefined') return
    const barHeight = barRef.current?.offsetHeight ?? 0
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { rootMargin: `-${barHeight}px 0px 0px 0px` },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <header ref={barRef} className={styles.bar} data-scrolled={scrolled}>
        <div className={`glass-thick ${styles.backdrop}`} aria-hidden="true" />
        <div className={styles.inner}>
          <MoreMenu items={menuItems} align="left" />
          <h1 className={styles.title}>{title}</h1>
          <button
            type="button"
            className={`glass ${styles.bell}`}
            aria-label="Уведомления"
            onClick={onBellClick}
          >
            <BellIcon />
          </button>
        </div>
      </header>
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
    </>
  )
}
