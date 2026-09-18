/**
 * Сервер пуш-уведомлений для трекера подписок.
 * Приложение присылает подписку Web Push и расписание напоминаний, cron раз в 15 минут
 * отправляет те, чьё время пришло. Данные о подписках живут только на устройстве,
 * здесь хранятся лишь тексты ближайших напоминаний.
 */
import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push'
import { SERVICE_CATALOG } from './catalog'
import {
  iconsFromLinks,
  iconsFromManifest,
  imageSize,
  isValidHost,
  MAX_ICON_BYTES,
  MIN_CRISP_SIZE,
  parentHost,
  rankIcons,
  type IconCandidate,
  type LinkTag,
} from './logo'
import {
  isValidVaultId,
  parseEndpointRequest,
  parseSubscribeRequest,
  parseVaultWrite,
  type DeviceKeys,
} from './validate'

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
const STALE_VAULT_MS = 365 * DAY_MS
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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

interface VaultRow {
  blob: string
  version: number
  updated_at: number
}

/**
 * Хранилище синхронизации. Сервер видит только шифротекст: ключ остаётся на устройствах.
 * Запись проходит, если версия совпала с текущей, иначе 409 и свежая версия в ответе.
 */
async function handleVaultRead(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id')
  if (!isValidVaultId(id)) return json(400, { error: 'invalid id' }, cors)
  const row = await env.DB.prepare('SELECT blob, version, updated_at FROM vaults WHERE id = ?1')
    .bind(id)
    .first<VaultRow>()
  if (!row) return json(404, { error: 'empty vault' }, cors)
  return json(200, { blob: row.blob, version: row.version, updatedAt: row.updated_at }, cors)
}

async function handleVaultWrite(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const parsed = parseVaultWrite(await readJson(request))
  if (!parsed.ok) return json(400, { error: parsed.error }, cors)
  const { id, blob, version } = parsed.value
  const now = Date.now()

  const result = await env.DB.prepare(
    `INSERT INTO vaults (id, blob, version, updated_at) VALUES (?1, ?2, 1, ?3)
     ON CONFLICT (id) DO UPDATE SET blob = excluded.blob, version = vaults.version + 1, updated_at = excluded.updated_at
     WHERE vaults.version = ?4`,
  )
    .bind(id, blob, now, version)
    .run()

  if (result.meta.changes === 0) {
    const current = await env.DB.prepare('SELECT blob, version, updated_at FROM vaults WHERE id = ?1')
      .bind(id)
      .first<VaultRow>()
    return json(409, { blob: current?.blob, version: current?.version ?? 0, updatedAt: current?.updated_at ?? 0 }, cors)
  }
  return json(200, { version: version + 1, updatedAt: now }, cors)
}

async function handleVaultDelete(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const body = await readJson(request)
  const id = typeof body === 'object' && body !== null ? (body as { id?: unknown }).id : undefined
  if (!isValidVaultId(id)) return json(400, { error: 'invalid id' }, cors)
  await env.DB.prepare('DELETE FROM vaults WHERE id = ?1').bind(id).run()
  return json(200, {}, cors)
}

/** Каталог меняется редко: сутки кэша и на устройстве, и в CDN. */
const CATALOG_TTL_SECONDS = 24 * 60 * 60

/** GET /api/catalog — готовые сервисы для формы подписки. */
function handleCatalog(cors: Record<string, string>): Response {
  return json(
    200,
    { services: SERVICE_CATALOG },
    { ...cors, 'Cache-Control': `public, max-age=${CATALOG_TTL_SECONDS}` },
  )
}

const LOGO_TTL_SECONDS = 7 * 24 * 60 * 60
const LOGO_MISS_TTL_SECONDS = 60 * 60
const LOGO_FETCH_TIMEOUT_MS = 5000
/** Сколько лучших кандидатов пробуем скачать: у бесплатного тарифа 50 исходящих запросов. */
const LOGO_MAX_ATTEMPTS = 8
const BOT_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; SubscriptionTrackerLogo/1.0)' }

function fetchWithTimeout(url: string, accept: string): Promise<Response> {
  return fetch(url, {
    headers: { ...BOT_HEADERS, Accept: accept },
    redirect: 'follow',
    signal: AbortSignal.timeout(LOGO_FETCH_TIMEOUT_MS),
  })
}

/** Иконки из разметки и manifest главной страницы домена. Ошибка сети — пустой список. */
async function collectIcons(host: string): Promise<IconCandidate[]> {
  let page: Response
  try {
    page = await fetchWithTimeout(`https://${host}/`, 'text/html')
  } catch {
    return []
  }
  const pageUrl = page.url || `https://${host}/`
  const links: LinkTag[] = []
  let manifestHref: string | null = null
  if (page.ok && (page.headers.get('Content-Type') ?? '').includes('html')) {
    // HTMLRewriter разбирает страницу потоком: нужны только <link> из разметки.
    await new HTMLRewriter()
      .on('link[rel][href]', {
        element(element) {
          const rel = element.getAttribute('rel') ?? ''
          const href = element.getAttribute('href') ?? ''
          if (rel.toLowerCase().split(/\s+/).includes('manifest')) manifestHref ??= href
          else links.push({ rel, href, sizes: element.getAttribute('sizes'), type: element.getAttribute('type') })
        },
      })
      .transform(page)
      .arrayBuffer()
  }

  const icons = iconsFromLinks(links, pageUrl)
  if (manifestHref) {
    try {
      const manifestUrl = new URL(manifestHref, pageUrl).href
      const response = await fetchWithTimeout(manifestUrl, 'application/manifest+json, application/json')
      if (response.ok) icons.push(...iconsFromManifest(await response.json(), manifestUrl))
    } catch {
      // Битый manifest не мешает остальным иконкам.
    }
  }
  // Многие сайты кладут иконку по стандартному адресу, не объявляя её в разметке.
  icons.push({ url: new URL('/apple-touch-icon.png', pageUrl).href, size: 180 })
  return icons
}

/** Значок из индекса Google в высоком разрешении: если у Google есть крупная версия, она чёткая. */
function googleIcon(host: string): IconCandidate {
  const url = `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=256&url=https://${host}`
  return { url, size: 256 }
}

/** Скачивает иконку и отдаёт её, только если она по-настоящему чёткая: SVG или от 96 px. */
async function fetchIcon(url: string): Promise<Response | null> {
  try {
    const response = await fetchWithTimeout(url, 'image/*')
    const type = (response.headers.get('Content-Type') ?? '').split(';')[0].trim()
    if (!response.ok || !type.startsWith('image/')) return null
    const body = await response.arrayBuffer()
    if (body.byteLength === 0 || body.byteLength > MAX_ICON_BYTES) return null
    if (type !== 'image/svg+xml' && (imageSize(new Uint8Array(body)) ?? 0) < MIN_CRISP_SIZE) return null
    return new Response(body, {
      headers: {
        'Content-Type': type,
        'Cache-Control': `public, max-age=${LOGO_TTL_SECONDS}`,
        'Access-Control-Allow-Origin': '*',
        // SVG открывается только как картинка: скрипты внутри не выполнятся.
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return null
  }
}

/**
 * GET /api/logo?host=kinopoisk.ru — самая чёткая иконка сайта.
 * Запрос идёт из <img>, поэтому без проверки Origin. Ответы кэшируются на неделю, промахи — на час.
 */
async function handleLogo(request: Request, ctx: ExecutionContext): Promise<Response> {
  const host = new URL(request.url).searchParams.get('host')
  if (!isValidHost(host)) return new Response('invalid host', { status: 400 })

  // Версия в ключе: при смене правил выбора иконки старый кэш не используется.
  const cacheKey = new Request(`https://logo-cache.internal/v3/${host}`)
  const cached = await caches.default.match(cacheKey)
  if (cached) return cached

  let response: Response | null = null
  try {
    // Порядок: иконки сайта → иконки основного домена (plus.yandex.ru → yandex.ru) → крупный значок Google.
    // По три лучших с каждого домена, чтобы до значка Google очередь дошла в пределах лимита запросов.
    const parent = parentHost(host)
    const own = rankIcons(await collectIcons(host)).slice(0, 3)
    const inherited = parent ? rankIcons(await collectIcons(parent)).slice(0, 3) : []
    const icons = [...own, ...inherited, googleIcon(host), ...(parent ? [googleIcon(parent)] : [])]
    for (const icon of icons.slice(0, LOGO_MAX_ATTEMPTS)) {
      response = await fetchIcon(icon.url)
      if (response) break
    }
  } catch {
    response = null
  }
  response ??= new Response('logo not found', {
    status: 404,
    headers: { 'Cache-Control': `public, max-age=${LOGO_MISS_TTL_SECONDS}`, 'Access-Control-Allow-Origin': '*' },
  })
  ctx.waitUntil(caches.default.put(cacheKey, response.clone()))
  return response
}

async function sendDueReminders(env: Env): Promise<void> {
  const now = Date.now()
  await env.DB.batch([
    env.DB.prepare('DELETE FROM reminders WHERE at < ?1').bind(now - STALE_REMINDER_MS),
    env.DB.prepare(
      'DELETE FROM reminders WHERE endpoint IN (SELECT endpoint FROM devices WHERE updated_at < ?1)',
    ).bind(now - STALE_DEVICE_MS),
    env.DB.prepare('DELETE FROM devices WHERE updated_at < ?1').bind(now - STALE_DEVICE_MS),
    // Хранилища синхронизации без обновлений год считаем брошенными.
    env.DB.prepare('DELETE FROM vaults WHERE updated_at < ?1').bind(now - STALE_VAULT_MS),
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
  async fetch(request, env, ctx): Promise<Response> {
    if (request.method === 'GET' && new URL(request.url).pathname === '/api/logo') return handleLogo(request, ctx)

    const cors = corsHeaders(request, env)
    if (!cors) return new Response('Forbidden', { status: 403 })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const { pathname } = new URL(request.url)
    try {
      if (pathname === '/api/catalog' && request.method === 'GET') return handleCatalog(cors)
      if (pathname === '/api/subscribe' && request.method === 'POST') return await handleSubscribe(request, env, cors)
      if (pathname === '/api/subscribe' && request.method === 'DELETE') return await handleUnsubscribe(request, env, cors)
      if (pathname === '/api/test' && request.method === 'POST') return await handleTest(request, env, cors)
      if (pathname === '/api/vault' && request.method === 'GET') return await handleVaultRead(request, env, cors)
      if (pathname === '/api/vault' && request.method === 'PUT') return await handleVaultWrite(request, env, cors)
      if (pathname === '/api/vault' && request.method === 'DELETE') return await handleVaultDelete(request, env, cors)
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
