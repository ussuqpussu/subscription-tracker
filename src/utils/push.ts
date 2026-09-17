/**
 * Web Push: подписка устройства и отправка расписания напоминаний на сервер уведомлений.
 * Адрес сервера и публичный VAPID-ключ задаются при сборке (.env.production).
 * Без них пуши выключены, а напоминания работают только через календарь.
 */
import { API_URL as apiUrl } from '../config'
import type { Subscription } from '../types'
import { buildPushReminders } from './pushReminders'

const vapidPublicKey = String(import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '')

export const isPushConfigured = apiUrl !== '' && vapidPublicKey !== ''

/**
 * unconfigured — сервер не задан при сборке; unsupported — браузер без Web Push;
 * needs-install — iPhone в Safari: пуши работают только с экрана «Домой»;
 * denied — пользователь запретил уведомления в системе.
 */
export type PushState = 'unconfigured' | 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

export class PushError extends Error {}

/** Сервер уведомлений ответил не 2xx. */
class PushServerError extends PushError {
  readonly status: number

  constructor(status: number) {
    super(`Сервер уведомлений ответил ошибкой ${status}.`)
    this.status = status
  }
}

function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function isAppleMobile(): boolean {
  const ua = navigator.userAgent
  // iPadOS представляется как Mac, но с сенсорным экраном.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

async function getPushSubscription(): Promise<PushSubscription | null> {
  // getRegistration, а не ready: в dev service worker нет, и ready никогда не завершится.
  const registration = await navigator.serviceWorker.getRegistration()
  return registration ? registration.pushManager.getSubscription() : null
}

export async function getPushState(): Promise<PushState> {
  if (!isPushConfigured) return 'unconfigured'
  if (!isPushSupported()) return isAppleMobile() && !isStandalone() ? 'needs-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'
  return (await getPushSubscription()) ? 'on' : 'off'
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function callServer(method: 'POST' | 'DELETE', path: string, body: unknown): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new PushError('Сервер уведомлений недоступен. Проверьте интернет.')
  }
  if (!response.ok) throw new PushServerError(response.status)
}

function sendSchedule(subscription: PushSubscription, subscriptions: readonly Subscription[], now: Date) {
  const { endpoint, keys } = subscription.toJSON()
  return callServer('POST', '/api/subscribe', {
    endpoint,
    keys,
    reminders: buildPushReminders(subscriptions, now),
  })
}

/**
 * Включает пуши. Вызывать прямо из обработчика нажатия:
 * iOS показывает запрос разрешения только в ответ на жест, поэтому requestPermission идёт первым.
 */
export async function enablePush(subscriptions: readonly Subscription[], now: Date): Promise<PushState> {
  const permission = await Notification.requestPermission()
  if (permission === 'denied') return 'denied'
  if (permission !== 'granted') return 'off'

  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) throw new PushError('Приложение ещё не готово к уведомлениям. Перезапустите его и попробуйте снова.')

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(vapidPublicKey),
    }))
  await sendSchedule(subscription, subscriptions, now)
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  const subscription = await getPushSubscription()
  if (subscription) {
    const { endpoint } = subscription
    await subscription.unsubscribe()
    // Если сервер не ответил, он удалит устройство сам, когда пуш-сервис вернёт 410.
    await callServer('DELETE', '/api/subscribe', { endpoint }).catch(() => undefined)
  }
  return 'off'
}

/** Обновляет расписание на сервере. Тихо ничего не делает, если пуши выключены. */
export async function syncPush(subscriptions: readonly Subscription[], now: Date): Promise<void> {
  if (!isPushConfigured || !isPushSupported() || Notification.permission !== 'granted') return
  const subscription = await getPushSubscription()
  if (subscription) await sendSchedule(subscription, subscriptions, now)
}

export async function sendTestPush(): Promise<void> {
  const subscription = await getPushSubscription()
  if (!subscription) throw new PushError('Уведомления выключены.')
  try {
    await callServer('POST', '/api/test', { endpoint: subscription.endpoint })
  } catch (error) {
    if (error instanceof PushServerError) {
      if (error.status === 429) throw new PushError('Тестовое уведомление можно отправлять раз в минуту. Подождите немного.')
      if (error.status === 404 || error.status === 410) {
        throw new PushError('Сервер не знает это устройство. Выключите и снова включите уведомления.')
      }
    }
    throw error
  }
}
