import { describe, expect, it } from 'vitest'
import { parseCatalog } from './catalog'

describe('каталог сервисов', () => {
  it('разбирает ответ сервера', () => {
    const raw = { services: [{ name: 'Кинопоиск', url: 'https://www.kinopoisk.ru/', category: 'Кино' }] }
    expect(parseCatalog(raw)).toEqual([{ name: 'Кинопоиск', url: 'https://www.kinopoisk.ru/', category: 'Кино' }])
  })

  it('записи без названия или адреса пропускаются, категория необязательна', () => {
    const raw = {
      services: [
        { name: '', url: 'https://ya.ru/', category: 'Развлечения' },
        { name: 'Okko', url: '   ', category: 'Кино' },
        { name: 'Notion', url: 'https://www.notion.so/' },
      ],
    }
    expect(parseCatalog(raw)).toEqual([{ name: 'Notion', url: 'https://www.notion.so/', category: '' }])
  })

  it('непохожий ответ — null: останется встроенный список', () => {
    expect(parseCatalog(null)).toBeNull()
    expect(parseCatalog({ services: 'нет' })).toBeNull()
    expect(parseCatalog({ services: [{ name: 'Без адреса' }] })).toBeNull()
  })
})
