import { useEffect, useMemo, useState } from 'react'
import { parseISODate, toISODate } from '../utils/dateUtils'

/**
 * Сегодняшняя дата (локальная полночь).
 * Обновляется после полуночи и когда приложение снова становится видимым:
 * на iPhone таймеры в фоне замирают, а PWA может неделями жить без перезапуска.
 */
export function useToday(): Date {
  const [todayISO, setTodayISO] = useState(() => toISODate(new Date()))

  useEffect(() => {
    let timer: number | undefined
    const refresh = () => setTodayISO(toISODate(new Date()))

    const scheduleMidnight = () => {
      const now = new Date()
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5)
      timer = window.setTimeout(() => {
        refresh()
        scheduleMidnight()
      }, nextMidnight.getTime() - now.getTime())
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    scheduleMidnight()
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
    }
  }, [])

  return useMemo(() => parseISODate(todayISO), [todayISO])
}
