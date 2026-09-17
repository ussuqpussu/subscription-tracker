/**
 * Сервер пуш-уведомлений для трекера подписок.
 * Приложение присылает подписку Web Push и расписание напоминаний, cron раз в 15 минут
 * отправляет те, чьё время пришло. Данные о подписках живут только на устройстве,
 * здесь хранятся лишь тексты ближайших напоминаний.
 */
import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push'
import { parseEndpointRequest, parseSubscribeRequest, type DeviceKeys } from './validate'

export interface Env {
  DB: D1Database
  /** Сайты, которым разрешено обращаться к серверу, через запятую. */
  ALLOWED_ORIGINS: string
  VAPID_SUBJECT: string
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
/** Напоминание, которое не удалось доставить за сутки, уже неактуально. */
const STALE_REMINDER_MS = DAY_MS
/** Приложение синхронизируется при каждом открытии; устройство без синхронизаций полгода считаем удалённым. */
const STALE_DEVICE_MS = 180 * DAY_MS
const TEST_COOLDOWN_MS = 60 * 1000
const MAX_BODY_BYTES = 128 * 1024
/** Бесплатный тариф Workers разрешает 50 исходящих запросов за запуск. */
const SEND_LIMIT = 40

interface PushMessageData {
  title: string
  body: string
  tag?: string
}

interface DueReminderRow {
  id: number
  title: string
  body: string
  tag: string
  endpoint: string
  p256dh: string
  auth: string
}

function corsHeaders(request: Request, env: Env): Record<string, string> | null {
  const origin = request.headers.get('Origin')
  const allowed = env.ALLOWED_ORIGINS.split(',').map((item) => item.trim())
  if (!origin || !allowed.includes(origin)) return null
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(status: number, body: unknown, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get('Content-Length') ?? 0)
  if (length > MAX_BODY_BYTES) return undefined
  try {
    const text = await request.text()
    return text.length > MAX_BODY_BYTES ? undefined : (JSON.parse(text) as unknown)
  } catch {
    return undefined
  }
}

/** Возвращает HTTP-статус пуш-сервиса: 201 — принято, 404/410 — подписка больше не существует. */
async function sendPush(env: Env, endpoint: string, keys: DeviceKeys, data: PushMessageData): Promise<number> {
  const subscription: PushSubscription = { endpoint, expirationTime: null, keys }
  const payload = await buildPushPayload(
    { data: { ...data }, options: { ttl: 12 * 60 * 60, urgency: 'normal' } },
    subscription,
    { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
  )
  const response = await fetch(endpoint, payload)
  return response.status
}

const isGone = (status: number) => status === 404 || status === 410

function deleteDevices(env: Env, endpoints: string[]): D1PreparedStatement[] {
  const list = JSON.stringify(endpoints)
  return [
    env.DB.prepare('DELETE FROM reminders WHERE endpoint IN (SELECT value FROM json_each(?1))').bind(list),
    env.DB.prepare('DELETE FROM devices WHERE endpoint IN (SELECT value FROM json_each(?1))').bind(list),
  ]
}

async function handleSubscribe(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const now = Date.now()
  const parsed = parseSubscribeRequest(await readJson(request), now)
  if (!parsed.ok) return json(400, { error: parsed.error }, cors)
  const { endpoint, keys, reminders } = parsed.value

  // Весь список напоминаний устройства заменяется одной транзакцией.
  // Вставка через json_each — одна команда вместо сотни: у D1 лимит запросов и параметров.
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO devices (endpoint, p256dh, auth, updated_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, updated_at = excluded.updated_at`,
    ).bind(endpoint, keys.p256dh, keys.auth, now),
    env.DB.prepare('DELETE FROM reminders WHERE endpoint = ?1').bind(endpoint),
    env.DB.prepare(
      `INSERT INTO reminders (endpoint, at, title, body, tag)
       SELECT ?1, json_extract(value, '$.at'), json_extract(value, '$.title'), json_extract(value, '$.body'), json_extract(value, '$.tag')
       FROM json_each(?2)`,
    ).bind(endpoint, JSON.stringify(reminders)),
  ])
  return json(200, { reminders: reminders.length }, cors)
}

async function handleUnsubscribe(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const parsed = parseEndpointRequest(await readJson(request))
  if (!parsed.ok) return json(400, { error: parsed.error }, cors)
  await env.DB.batch(deleteDevices(env, [parsed.value]))
  return json(200, {}, cors)
}

async function handleTest(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const parsed = parseEndpointRequest(await readJson(request))
  if (!parsed.ok) return json(400, { error: parsed.error }, cors)

  const device = await env.DB.prepare('SELECT p256dh, auth, last_test_at FROM devices WHERE endpoint = ?1')
    .bind(parsed.value)
    .first<{ p256dh: string; auth: string; last_test_at: number | null }>()
  if (!device) return json(404, { error: 'unknown device' }, cors)

  const now = Date.now()
  if (device.last_test_at !== null && now - device.last_test_at < TEST_COOLDOWN_MS) {
    return json(429, { error: 'too many tests' }, cors)
  }
  await env.DB.prepare('UPDATE devices SET last_test_at = ?1 WHERE endpoint = ?2').bind(now, parsed.value).run()

  const status = await sendPush(
    env,
    parsed.value,
    { p256dh: device.p256dh, auth: device.auth },
    // Название приложения iOS показывает сама («from Подписки»): в заголовке его не повторяем.
    { title: 'Уведомления работают', body: 'Напомним о платежах заранее.', tag: 'test' },
  )
  if (isGone(status)) {
    await env.DB.batch(deleteDevices(env, [parsed.value]))
    return json(410, { error: 'subscription expired' }, cors)
  }
  return status >= 200 && status < 300 ? json(200, {}, cors) : json(502, { error: `push service ${status}` }, cors)
}

async function sendDueReminders(env: Env): Promise<void> {
  const now = Date.now()
  await env.DB.batch([
    env.DB.prepare('DELETE FROM reminders WHERE at < ?1').bind(now - STALE_REMINDER_MS),
    env.DB.prepare(
      'DELETE FROM reminders WHERE endpoint IN (SELECT endpoint FROM devices WHERE updated_at < ?1)',
    ).bind(now - STALE_DEVICE_MS),
    env.DB.prepare('DELETE FROM devices WHERE updated_at < ?1').bind(now - STALE_DEVICE_MS),
  ])

  const { results } = await env.DB.prepare(
    `SELECT r.id, r.title, r.body, r.tag, d.endpoint, d.p256dh, d.auth
     FROM reminders r JOIN devices d ON d.endpoint = r.endpoint
     WHERE r.at <= ?1 ORDER BY r.at LIMIT ?2`,
  )
    .bind(now, SEND_LIMIT)
    .all<DueReminderRow>()
  if (results.length === 0) return

  const done: number[] = []
  const gone = new Set<string>()
  for (const row of results) {
    if (gone.has(row.endpoint)) continue
    let status: number
    try {
      status = await sendPush(env, row.endpoint, { p256dh: row.p256dh, auth: row.auth }, row)
    } catch (error) {
      console.error('push failed', error)
      continue
    }
    if (isGone(status)) gone.add(row.endpoint)
    // 429 и 5xx — временные сбои: напоминание остаётся до следующего запуска (но не дольше суток).
    else if (status !== 429 && status < 500) done.push(row.id)
  }

  const statements = gone.size > 0 ? deleteDevices(env, [...gone]) : []
  if (done.length > 0) {
    statements.push(
      env.DB.prepare('DELETE FROM reminders WHERE id IN (SELECT value FROM json_each(?1))').bind(JSON.stringify(done)),
    )
  }
  if (statements.length > 0) await env.DB.batch(statements)
}

export default {
  async fetch(request, env): Promise<Response> {
    const cors = corsHeaders(request, env)
    if (!cors) return new Response('Forbidden', { status: 403 })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const { pathname } = new URL(request.url)
    try {
      if (pathname === '/api/subscribe' && request.method === 'POST') return await handleSubscribe(request, env, cors)
      if (pathname === '/api/subscribe' && request.method === 'DELETE') return await handleUnsubscribe(request, env, cors)
      if (pathname === '/api/test' && request.method === 'POST') return await handleTest(request, env, cors)
    } catch (error) {
      console.error('request failed', error)
      return json(500, { error: 'internal error' }, cors)
    }
    return json(404, { error: 'not found' }, cors)
  },

  async scheduled(_controller, env, ctx): Promise<void> {
    ctx.waitUntil(sendDueReminders(env))
  },
} satisfies ExportedHandler<Env>
