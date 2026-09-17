import { describe, expect, it } from 'vitest'
import {
  isPushEndpoint,
  isValidVaultId,
  MAX_REMINDERS,
  parseEndpointRequest,
  parseSubscribeRequest,
  parseVaultWrite,
} from './validate'

const now = Date.UTC(2026, 8, 17, 12)
const keys = { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) }
const reminder = { at: now + 3_600_000, title: 'Кинопоиск: платёж завтра', body: '299 ₽ · 18 сентября', tag: 'k:2026-09-18:1' }
const request = (overrides: Record<string, unknown> = {}) => ({
  endpoint: 'https://web.push.apple.com/QGuQyavXutnMH',
  keys,
  reminders: [reminder],
  ...overrides,
})

describe('адрес пуш-сервиса', () => {
  it('принимает Apple, FCM, Mozilla и Windows', () => {
    expect(isPushEndpoint('https://web.push.apple.com/abc')).toBe(true)
    expect(isPushEndpoint('https://api.push.apple.com/abc')).toBe(true)
    expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true)
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true)
    expect(isPushEndpoint('https://db5p.notify.windows.com/w/?token=abc')).toBe(true)
  })

  it('отклоняет чужие хосты, http и мусор', () => {
    expect(isPushEndpoint('https://evil.example.com/web.push.apple.com')).toBe(false)
    expect(isPushEndpoint('https://web.push.apple.com.evil.com/abc')).toBe(false)
    expect(isPushEndpoint('http://web.push.apple.com/abc')).toBe(false)
    expect(isPushEndpoint('not a url')).toBe(false)
    expect(isPushEndpoint(42)).toBe(false)
    expect(parseEndpointRequest({ endpoint: 'https://example.com' }).ok).toBe(false)
    expect(parseEndpointRequest({ endpoint: 'https://fcm.googleapis.com/fcm/send/x' })).toEqual({
      ok: true,
      value: 'https://fcm.googleapis.com/fcm/send/x',
    })
  })
})

describe('запрос подписки', () => {
  it('корректный запрос проходит без лишних полей', () => {
    const result = parseSubscribeRequest(request({ extra: true, reminders: [{ ...reminder, junk: 1 }] }), now)
    expect(result).toEqual({
      ok: true,
      value: { endpoint: 'https://web.push.apple.com/QGuQyavXutnMH', keys, reminders: [reminder] },
    })
  })

  it('пустое расписание допустимо', () => {
    expect(parseSubscribeRequest(request({ reminders: [] }), now).ok).toBe(true)
  })

  it('отклоняет плохие ключи', () => {
    expect(parseSubscribeRequest(request({ keys: { ...keys, p256dh: 'short' } }), now).ok).toBe(false)
    expect(parseSubscribeRequest(request({ keys: { ...keys, auth: 'bad key!' } }), now).ok).toBe(false)
    expect(parseSubscribeRequest(request({ keys: null }), now).ok).toBe(false)
  })

  it('отклоняет слишком много или неправильные напоминания', () => {
    const many = Array.from({ length: MAX_REMINDERS + 1 }, () => reminder)
    expect(parseSubscribeRequest(request({ reminders: many }), now).ok).toBe(false)
    expect(parseSubscribeRequest(request({ reminders: [{ ...reminder, at: '1' }] }), now).ok).toBe(false)
    expect(parseSubscribeRequest(request({ reminders: [{ ...reminder, at: now + 500 * 86_400_000 }] }), now).ok).toBe(
      false,
    )
    expect(parseSubscribeRequest(request({ reminders: [{ ...reminder, title: '' }] }), now).ok).toBe(false)
    expect(parseSubscribeRequest(request({ reminders: [{ ...reminder, body: 'x'.repeat(201) }] }), now).ok).toBe(false)
  })
})

describe('хранилище синхронизации', () => {
  const id = 'a'.repeat(64)

  it('принимает шифротекст с версией', () => {
    expect(parseVaultWrite({ id, blob: 'AAAA.BBBB', version: 3 })).toEqual({
      ok: true,
      value: { id, blob: 'AAAA.BBBB', version: 3 },
    })
  })

  it('отклоняет чужой формат', () => {
    expect(isValidVaultId(id)).toBe(true)
    expect(isValidVaultId('A'.repeat(64))).toBe(false)
    expect(parseVaultWrite({ id: 'short', blob: 'AA.BB', version: 0 }).ok).toBe(false)
    expect(parseVaultWrite({ id, blob: 'без точки', version: 0 }).ok).toBe(false)
    expect(parseVaultWrite({ id, blob: 'AA.BB', version: -1 }).ok).toBe(false)
    expect(parseVaultWrite({ id, blob: `${'A'.repeat(600000)}.BB`, version: 0 }).ok).toBe(false)
  })
})
