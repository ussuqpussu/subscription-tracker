import { describe, expect, it } from 'vitest'
import { getDisplayHost, getSiteLogoUrl, isValidLogo, MAX_LOGO_LENGTH, normalizeUrl } from './logo'

describe('ссылка на сайт', () => {
  it('дописывает https и нормализует адрес', () => {
    expect(normalizeUrl('kinopoisk.ru')).toBe('https://kinopoisk.ru/')
    expect(normalizeUrl('  www.kinopoisk.ru/subscriptions ')).toBe('https://www.kinopoisk.ru/subscriptions')
    expect(normalizeUrl('http://music.yandex.ru')).toBe('http://music.yandex.ru/')
    expect(normalizeUrl('Spotify.com')).toBe('https://spotify.com/')
  })

  it('отклоняет не ссылки', () => {
    expect(normalizeUrl('')).toBeNull()
    expect(normalizeUrl('kinopoisk')).toBeNull()
    expect(normalizeUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeUrl('ftp://files.example.com')).toBeNull()
    expect(normalizeUrl('кино поиск.рф')).toBeNull()
    expect(normalizeUrl('example..com')).toBeNull()
  })

  it('подпись и адрес значка', () => {
    expect(getDisplayHost('https://www.kinopoisk.ru/subscriptions')).toBe('kinopoisk.ru')
    expect(getSiteLogoUrl('https://www.kinopoisk.ru/x')).toBe(
      'https://www.google.com/s2/favicons?sz=128&domain=www.kinopoisk.ru',
    )
    expect(getSiteLogoUrl('не ссылка')).toBeNull()
  })
})

describe('свой логотип', () => {
  it('принимает только небольшие data URL картинок', () => {
    expect(isValidLogo('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
    expect(isValidLogo('data:image/webp;base64,UklGRg==')).toBe(true)
    expect(isValidLogo('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false)
    expect(isValidLogo('https://example.com/logo.png')).toBe(false)
    expect(isValidLogo(`data:image/png;base64,${'A'.repeat(MAX_LOGO_LENGTH)}`)).toBe(false)
    expect(isValidLogo(42)).toBe(false)
  })
})
