import { useEffect, useRef, useState } from 'react'
import { MoreMenu, type MenuItem } from './MoreMenu'
import styles from './NavBar.module.css'

interface NavBarProps {
  title: string
  menuItems: readonly MenuItem[]
}

/**
 * Навбар iOS: большой заголовок в контенте, а при прокрутке — компактная стеклянная полоса
 * с маленьким заголовком по центру.
 */
export function NavBar({ title, menuItems }: NavBarProps) {
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
          <span className={styles.compactTitle} aria-hidden="true">
            {title}
          </span>
          <div className={styles.trailing}>
            <MoreMenu items={menuItems} />
          </div>
        </div>
      </header>
      <div className={styles.largeTitleWrap}>
        <h1 className={styles.largeTitle}>{title}</h1>
      </div>
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
    </>
  )
}
