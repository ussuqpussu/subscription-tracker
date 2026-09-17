/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (PrecacheEntry | string)[] }

// Кэш приложения: после установки на экран «Домой» оно открывается без сети.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// registerType: 'autoUpdate' — новая версия сразу берёт управление страницами.
void self.skipWaiting()
clientsClaim()

interface PushPayload {
  title: string
  body: string
  tag?: string
}

function readPayload(data: PushMessageData | null): PushPayload {
  try {
    const value = data?.json() as Partial<PushPayload> | undefined
    if (value && typeof value.title === 'string') {
      return {
        title: value.title,
        body: typeof value.body === 'string' ? value.body : '',
        tag: typeof value.tag === 'string' ? value.tag : undefined,
      }
    }
  } catch {
    // Не JSON — показываем текст как есть.
  }
  return { title: 'Подписки', body: data?.text() ?? '' }
}

self.addEventListener('push', (event) => {
  const payload = readPayload(event.data)
  // Каждый пуш обязан показать уведомление: за «тихие» пуши iOS отзывает подписку.
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: 'pwa-192x192.png',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const scope = self.registration.scope
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const opened = windows.find((client) => client.url.startsWith(scope))
      if (opened) await opened.focus()
      else await self.clients.openWindow(scope)
    })(),
  )
})
