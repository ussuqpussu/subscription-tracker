/**
 * Проверка запросов от приложения. Сервер открыт в интернет без авторизации,
 * поэтому принимает только адреса настоящих пуш-сервисов и ограничивает размеры.
 */

/** Столько напоминаний хранится на одно устройство (совпадает с лимитом клиента). */
export const MAX_REMINDERS = 200
export const MAX_TEXT_LENGTH = 200
export const MAX_TAG_LENGTH = 120
/** Напоминания дальше этого срока не принимаются: клиент шлёт расписание на 120 дней. */
export const MAX_SCHEDULE_AHEAD_MS = 400 * 24 * 60 * 60 * 1000

const PUSH_HOSTS = new Set(['web.push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com'])
const PUSH_HOST_SUFFIXES = ['.push.apple.com', '.notify.windows.com']
const BASE64URL_RE = /^[A-Za-z0-9_-]+={0,2}$/

export interface DeviceKeys {
  p256dh: string
  auth: string
}

export interface Reminder {
  at: number
  title: string
  body: string
  tag: string
}

export interface SubscribeRequest {
  endpoint: string
  keys: DeviceKeys
  reminders: Reminder[]
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

const fail = (error: string): Parsed<never> => ({ ok: false, error })

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 1024) return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  return (
    url.protocol === 'https:' &&
    (PUSH_HOSTS.has(url.hostname) || PUSH_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix)))
  )
}

/** p256dh — 65 байт (87–88 символов base64url), auth — 16 байт (22–24 символа). */
function isKey(value: unknown, minLength: number, maxLength: number): value is string {
  return typeof value === 'string' && value.length >= minLength && value.length <= maxLength && BASE64URL_RE.test(value)
}

function isText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
}

export function parseEndpointRequest(body: unknown): Parsed<string> {
  if (!isRecord(body) || !isPushEndpoint(body.endpoint)) return fail('invalid endpoint')
  return { ok: true, value: body.endpoint }
}

export function parseSubscribeRequest(body: unknown, now: number): Parsed<SubscribeRequest> {
  if (!isRecord(body)) return fail('invalid body')
  if (!isPushEndpoint(body.endpoint)) return fail('invalid endpoint')

  const { keys, reminders } = body
  if (!isRecord(keys) || !isKey(keys.p256dh, 80, 100) || !isKey(keys.auth, 16, 32)) return fail('invalid keys')

  if (!Array.isArray(reminders) || reminders.length > MAX_REMINDERS) return fail('invalid reminders')
  const parsed: Reminder[] = []
  for (const item of reminders) {
    if (
      !isRecord(item) ||
      typeof item.at !== 'number' ||
      !Number.isSafeInteger(item.at) ||
      item.at > now + MAX_SCHEDULE_AHEAD_MS ||
      !isText(item.title, MAX_TEXT_LENGTH) ||
      !isText(item.body, MAX_TEXT_LENGTH) ||
      !isText(item.tag, MAX_TAG_LENGTH)
    ) {
      return fail('invalid reminder')
    }
    parsed.push({ at: item.at, title: item.title, body: item.body, tag: item.tag })
  }

  return {
    ok: true,
    value: { endpoint: body.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, reminders: parsed },
  }
}

/** Размер шифротекста: 500 подписок с историей помещаются с запасом. */
export const MAX_VAULT_BYTES = 512 * 1024
const VAULT_ID_RE = /^[0-9a-f]{64}$/
const VAULT_BLOB_RE = /^[A-Za-z0-9+/]+={0,2}\.[A-Za-z0-9+/]+={0,2}$/

export interface VaultWrite {
  id: string
  blob: string
  /** Версия, которая сейчас на сервере по мнению устройства. 0 — записи ещё нет. */
  version: number
}

export function isValidVaultId(value: unknown): value is string {
  return typeof value === 'string' && VAULT_ID_RE.test(value)
}

export function parseVaultWrite(body: unknown): Parsed<VaultWrite> {
  if (!isRecord(body)) return fail('invalid body')
  if (!isValidVaultId(body.id)) return fail('invalid id')
  if (typeof body.blob !== 'string' || body.blob.length > MAX_VAULT_BYTES || !VAULT_BLOB_RE.test(body.blob)) {
    return fail('invalid blob')
  }
  if (typeof body.version !== 'number' || !Number.isSafeInteger(body.version) || body.version < 0) {
    return fail('invalid version')
  }
  return { ok: true, value: { id: body.id, blob: body.blob, version: body.version } }
}
