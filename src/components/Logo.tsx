import { useState } from 'react'
import { API_URL } from '../config'
import type { Subscription } from '../types'
import { getInitial } from '../utils/format'
import { getSiteLogoUrls } from '../utils/logo'
import styles from './Logo.module.css'

interface LogoProps {
  subscription: Pick<Subscription, 'name' | 'url' | 'logo'>
  className?: string
}

/** Сервис Google отдаёт глобус 16×16, если у сайта нет значка: такой считаем отсутствующим. */
const MIN_SITE_ICON_SIZE = 17

/**
 * Плитка-логотип: свой логотип → чёткая иконка с сайта → значок Google → первая буква названия.
 * Если картинка не загрузилась, берётся следующий источник. Размер задаёт родитель через --logo-size.
 */
export function Logo({ subscription, className }: LogoProps) {
  const { name, url, logo } = subscription
  const sources = logo ? [logo] : url ? getSiteLogoUrls(url, API_URL) : []
  const sourcesKey = sources.join('\n')
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
          key={source}
          className={styles.image}
          src={source}
          alt=""
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={tryNext}
          onLoad={(event) => {
            if (!logo && event.currentTarget.naturalWidth < MIN_SITE_ICON_SIZE) tryNext()
          }}
        />
      ) : (
        getInitial(name)
      )}
    </span>
  )
}
