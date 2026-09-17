import { useState } from 'react'
import type { Subscription } from '../types'
import { getInitial } from '../utils/format'
import { getSiteLogoUrl } from '../utils/logo'
import styles from './Logo.module.css'

interface LogoProps {
  subscription: Pick<Subscription, 'name' | 'url' | 'logo'>
  className?: string
}

/** Сервис Google отдаёт глобус 16×16, если у сайта нет значка: такой считаем отсутствующим. */
const MIN_SITE_ICON_SIZE = 17

/**
 * Плитка-логотип: свой логотип → значок сайта → первая буква названия.
 * Размер задаёт родитель через --logo-size.
 */
export function Logo({ subscription, className }: LogoProps) {
  const { name, url, logo } = subscription
  const source = logo ?? (url ? getSiteLogoUrl(url) : null)
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const showImage = source !== null && source !== failedSource
  const kind = !showImage ? 'letter' : logo ? 'custom' : 'site'

  return (
    <span className={`${styles.logo} ${className ?? ''}`} data-kind={kind} aria-hidden="true">
      {showImage ? (
        <img
          key={source}
          className={styles.image}
          src={source}
          alt=""
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => setFailedSource(source)}
          onLoad={(event) => {
            if (!logo && event.currentTarget.naturalWidth < MIN_SITE_ICON_SIZE) setFailedSource(source)
          }}
        />
      ) : (
        getInitial(name)
      )}
    </span>
  )
}
