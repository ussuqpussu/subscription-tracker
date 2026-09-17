import type { Subscription } from '../types'
import { toISODate } from './dateUtils'
import { normalizeSubscriptions } from './subscriptionSchema'

export const BACKUP_APP_ID = 'subscription-tracker'
export const BACKUP_VERSION = 1

export interface BackupFile {
  app: typeof BACKUP_APP_ID
  version: typeof BACKUP_VERSION
  exportedAt: string
  subscriptions: Subscription[]
}

export function createBackup(subscriptions: readonly Subscription[], now: Date = new Date()): string {
  const backup: BackupFile = {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    subscriptions: [...subscriptions],
  }
  return `${JSON.stringify(backup, null, 2)}\n`
}

export function backupFileName(now: Date = new Date()): string {
  return `podpiski-backup-${toISODate(now)}.json`
}

export type ParseBackupResult =
  | { ok: true; subscriptions: Subscription[]; skipped: number }
  | { ok: false; error: string }

export function parseBackup(text: string): ParseBackupResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Файл повреждён или это не JSON.' }
  }

  if (
    typeof data !== 'object' ||
    data === null ||
    (data as Partial<BackupFile>).app !== BACKUP_APP_ID ||
    !Array.isArray((data as Partial<BackupFile>).subscriptions)
  ) {
    return { ok: false, error: 'Это не резервная копия трекера подписок.' }
  }

  const version = (data as Partial<BackupFile>).version
  if (typeof version !== 'number' || version > BACKUP_VERSION) {
    return { ok: false, error: 'Копия создана более новой версией приложения.' }
  }

  const { items, skipped } = normalizeSubscriptions((data as BackupFile).subscriptions)
  if (items.length === 0 && skipped > 0) {
    return { ok: false, error: 'В копии нет ни одной корректной подписки.' }
  }
  return { ok: true, subscriptions: items, skipped }
}
