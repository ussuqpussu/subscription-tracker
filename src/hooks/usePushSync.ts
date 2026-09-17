import { useEffect } from 'react'
import type { Subscription } from '../types'
import { syncPush } from '../utils/push'

const SYNC_DELAY_MS = 1500

/**
 * Держит расписание пушей на сервере актуальным: после изменений подписок (с паузой, чтобы
 * серия правок ушла одним запросом) и при смене дня — горизонт напоминаний сдвигается вперёд.
 */
export function usePushSync(subscriptions: readonly Subscription[], today: Date, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const timer = window.setTimeout(() => {
      syncPush(subscriptions, new Date()).catch(() => undefined)
    }, SYNC_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [subscriptions, today, enabled])
}
