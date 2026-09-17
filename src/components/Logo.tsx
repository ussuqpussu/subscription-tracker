import { useState } from 'react'
import { API_URL } from '../config'
import type { Subscription } from '../types'
import { getInitial } from '../utils/format'
import { getSiteLogoSources, type LogoSource } from '../utils/logo'
import styles from './Logo.module.css'

interface LogoProps {
  subscription: Pick<Subscription, 'name' | 'url' | 'logo'>
  className?: string
}

/**
 * Плитка-логотип: свой логотип → чёткая иконка сайта → первая буква названия.
 * Если картинка не загрузилась или слишком мелкая, берётся следующий источник.
 * Размер задаёт родитель через --logo-size.
 */
export function Logo({ subscription, className }: LogoProps) {
  const { name, url, logo } = subscription
  const sources: LogoSource[] = logo ? [{ src: logo, minWidth: 0 }] : url ? getSiteLogoSources(url, API_URL) : []
  const sourcesKey = sources.map((source) => source.src).join('\n')
  // Номер источника привязан к списку: сменилась ссылка — перебор начинается заново.
  const [attempt, setAttempt] = useState({ key: sourcesKey, index: 0 })
  const index = attempt.key === sourcesKey ? attempt.index : 0
  const source = sources[index]
  const kind = !source ? 'letter' : logo ? 'custom' : 'site'
  const tryNext = () => setAttempt({ key: sourcesKey, index: index + 1 })

  return (
    <span className={`${styles.logo} ${className ?? ''}`} data-kind={kind} aria-hidden="true">
      {source ? (
        <img
          key={source.src}
          className={styles.image}
          src={source.src}
          alt=""
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={tryNext}
          onLoad={(event) => {
            if (event.currentTarget.naturalWidth < source.minWidth) tryNext()
          }}
        />
      ) : (
        getInitial(name)
      )}
    </span>
  )
}
