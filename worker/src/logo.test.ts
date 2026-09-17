import { describe, expect, it } from 'vitest'
import { iconsFromLinks, iconsFromManifest, isValidHost, parseSizes, rankIcons, SVG_SIZE } from './logo'

describe('домен для поиска логотипа', () => {
  it('принимает обычные домены', () => {
    expect(isValidHost('kinopoisk.ru')).toBe(true)
    expect(isValidHost('open.spotify.com')).toBe(true)
    expect(isValidHost('xn--80aswg.xn--p1ai')).toBe(true)
  })

  it('отклоняет IP, localhost и мусор', () => {
    expect(isValidHost('127.0.0.1')).toBe(false)
    expect(isValidHost('localhost')).toBe(false)
    expect(isValidHost('Example.com')).toBe(false)
    expect(isValidHost('evil.com/path')).toBe(false)
    expect(isValidHost(null)).toBe(false)
  })
})

describe('иконки сайта', () => {
  it('размеры из атрибута sizes', () => {
    expect(parseSizes('180x180')).toBe(180)
    expect(parseSizes('16x16 32x32 192x192')).toBe(192)
    expect(parseSizes('any')).toBe(SVG_SIZE)
    expect(parseSizes('')).toBeNull()
  })

  it('собирает иконки из link с разумными размерами по умолчанию', () => {
    const icons = iconsFromLinks(
      [
        { rel: 'icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/apple.png' },
        { rel: 'icon', href: 'https://cdn.site.com/icon.svg' },
        { rel: 'stylesheet', href: '/style.css' },
        { rel: 'icon', href: 'javascript:alert(1)' },
      ],
      'https://www.site.com/app/',
    )
    expect(icons).toEqual([
      { url: 'https://www.site.com/favicon.ico', size: 32 },
      { url: 'https://www.site.com/apple.png', size: 180 },
      { url: 'https://cdn.site.com/icon.svg', size: SVG_SIZE },
    ])
  })

  it('берёт иконки из manifest, кроме монохромных', () => {
    const manifest = {
      icons: [
        { src: 'icons/512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icons/mono.png', sizes: '1024x1024', purpose: 'monochrome' },
        { src: 42 },
      ],
    }
    expect(iconsFromManifest(manifest, 'https://site.com/manifest.json')).toEqual([
      { url: 'https://site.com/icons/512.png', size: 512 },
    ])
    expect(iconsFromManifest('мусор', 'https://site.com/m.json')).toEqual([])
  })

  it('сортирует от крупной к мелкой, убирает повторы и мелочь', () => {
    expect(
      rankIcons([
        { url: 'a', size: 32 },
        { url: 'b', size: 180 },
        { url: 'c', size: 512 },
        { url: 'b', size: 192 },
      ]),
    ).toEqual([
      { url: 'c', size: 512 },
      { url: 'b', size: 192 },
    ])
  })
})
