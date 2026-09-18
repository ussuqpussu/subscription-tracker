/**
 * Каталог популярных сервисов: приложение забирает его ручкой GET /api/catalog
 * и показывает в форме подписки. Встроенный список в приложении короче — он нужен офлайн.
 */

export interface CatalogService {
  name: string
  /** Адрес, с которого берётся логотип. Выбран тот, где есть чёткая иконка. */
  url: string
  category: string
}

/** Порядок важен: сверху то, чем пользуются чаще. */
export const SERVICE_CATALOG: readonly CatalogService[] = [
  // Подписки-комбо
  { name: 'Яндекс Плюс', url: 'https://ya.ru/', category: 'Развлечения' },
  { name: 'СберПрайм', url: 'https://sber.ru/prime', category: 'Развлечения' },
  { name: 'МТС Premium', url: 'https://mts.ru/', category: 'Развлечения' },
  { name: 'VK Combo', url: 'https://vk.com/', category: 'Развлечения' },
  { name: 'Ozon Premium', url: 'https://www.ozon.ru/', category: 'Покупки' },
  { name: 'Т‑Банк Pro', url: 'https://www.tbank.ru/', category: 'Финансы' },

  // Кино и видео
  { name: 'Кинопоиск', url: 'https://www.kinopoisk.ru/', category: 'Кино' },
  { name: 'Okko', url: 'https://okko.tv/', category: 'Кино' },
  { name: 'Иви', url: 'https://www.ivi.ru/', category: 'Кино' },
  { name: 'Wink', url: 'https://wink.ru/', category: 'Кино' },
  { name: 'Premier', url: 'https://premier.one/', category: 'Кино' },
  { name: 'Start', url: 'https://start.ru/', category: 'Кино' },
  { name: 'KION', url: 'https://kion.ru/', category: 'Кино' },
  { name: 'Амедиатека', url: 'https://www.amediateka.ru/', category: 'Кино' },
  { name: 'Netflix', url: 'https://help.netflix.com/', category: 'Кино' },
  { name: 'Disney+', url: 'https://www.disneyplus.com/', category: 'Кино' },
  { name: 'Apple TV+', url: 'https://tv.apple.com/', category: 'Кино' },
  { name: 'Amazon Prime Video', url: 'https://www.primevideo.com/', category: 'Кино' },
  { name: 'HBO Max', url: 'https://www.max.com/', category: 'Кино' },
  { name: 'YouTube Premium', url: 'https://www.youtube.com/', category: 'Видео' },
  { name: 'Crunchyroll', url: 'https://www.crunchyroll.com/', category: 'Видео' },
  { name: 'Twitch Turbo', url: 'https://www.twitch.tv/', category: 'Видео' },

  // Музыка
  { name: 'Яндекс Музыка', url: 'https://music.yandex.ru/', category: 'Музыка' },
  { name: 'VK Музыка', url: 'https://vk.com/music', category: 'Музыка' },
  { name: 'Звук', url: 'https://zvuk.com/', category: 'Музыка' },
  { name: 'Spotify', url: 'https://open.spotify.com/', category: 'Музыка' },
  { name: 'Apple Music', url: 'https://music.apple.com/', category: 'Музыка' },
  { name: 'YouTube Music', url: 'https://music.youtube.com/', category: 'Музыка' },
  { name: 'Deezer', url: 'https://www.deezer.com/', category: 'Музыка' },
  { name: 'SoundCloud Go', url: 'https://soundcloud.com/', category: 'Музыка' },

  // Книги и подкасты
  { name: 'Литрес', url: 'https://www.litres.ru/', category: 'Книги' },
  { name: 'Строки', url: 'https://stroki.mts.ru/', category: 'Книги' },
  { name: 'Букмейт', url: 'https://bookmate.ru/', category: 'Книги' },
  { name: 'Storytel', url: 'https://www.storytel.com/', category: 'Книги' },

  // Облака
  { name: 'iCloud+', url: 'https://www.icloud.com/', category: 'Облако' },
  { name: 'Google One', url: 'https://one.google.com/', category: 'Облако' },
  { name: 'Яндекс 360', url: 'https://360.yandex.ru/', category: 'Облако' },
  { name: 'Облако Mail', url: 'https://cloud.mail.ru/', category: 'Облако' },
  { name: 'Dropbox', url: 'https://www.dropbox.com/', category: 'Облако' },
  { name: 'Microsoft OneDrive', url: 'https://onedrive.live.com/', category: 'Облако' },

  // Связь
  { name: 'Telegram Premium', url: 'https://telegram.org/', category: 'Связь' },
  { name: 'Discord Nitro', url: 'https://discord.com/', category: 'Связь' },
  { name: 'МТС', url: 'https://mts.ru/', category: 'Связь' },
  { name: 'МегаФон', url: 'https://megafon.ru/', category: 'Связь' },
  { name: 'Билайн', url: 'https://beeline.ru/', category: 'Связь' },
  { name: 'Tele2', url: 'https://tele2.ru/', category: 'Связь' },
  { name: 'Yota', url: 'https://www.yota.ru/', category: 'Связь' },

  // Игры
  { name: 'PlayStation Plus', url: 'https://www.playstation.com/', category: 'Игры' },
  { name: 'Xbox Game Pass', url: 'https://www.xbox.com/', category: 'Игры' },
  { name: 'Nintendo Switch Online', url: 'https://www.nintendo.com/', category: 'Игры' },
  { name: 'VK Play Cloud', url: 'https://vkplay.ru/', category: 'Игры' },
  { name: 'Apple Arcade', url: 'https://www.apple.com/apple-arcade/', category: 'Игры' },
  { name: 'EA Play', url: 'https://www.ea.com/', category: 'Игры' },

  // Обучение
  { name: 'Duolingo', url: 'https://www.duolingo.com/', category: 'Учёба' },
  { name: 'Skyeng', url: 'https://skyeng.ru/', category: 'Учёба' },
  { name: 'Яндекс Практикум', url: 'https://practicum.yandex.ru/', category: 'Учёба' },
  { name: 'Skillbox', url: 'https://skillbox.ru/', category: 'Учёба' },
  { name: 'Нетология', url: 'https://netology.ru/', category: 'Учёба' },
  { name: 'Coursera', url: 'https://www.coursera.org/', category: 'Учёба' },
  { name: 'Udemy', url: 'https://www.udemy.com/', category: 'Учёба' },

  // Работа
  { name: 'ChatGPT Plus', url: 'https://chatgpt.com/', category: 'Работа' },
  { name: 'Claude Pro', url: 'https://claude.ai/', category: 'Работа' },
  { name: 'Notion', url: 'https://www.notion.so/', category: 'Работа' },
  { name: 'GitHub', url: 'https://github.com/', category: 'Работа' },
  { name: 'Figma', url: 'https://www.figma.com/', category: 'Работа' },
  { name: 'Canva', url: 'https://www.canva.com/', category: 'Работа' },
  { name: 'Adobe Creative Cloud', url: 'https://www.adobe.com/', category: 'Работа' },
  { name: 'Microsoft 365', url: 'https://www.microsoft.com/microsoft-365', category: 'Работа' },
  { name: 'Google Workspace', url: 'https://workspace.google.com/', category: 'Работа' },
  { name: 'Zoom', url: 'https://zoom.us/', category: 'Работа' },
  { name: 'Miro', url: 'https://miro.com/', category: 'Работа' },
  { name: 'JetBrains', url: 'https://www.jetbrains.com/', category: 'Работа' },
  { name: '1Password', url: 'https://1password.com/', category: 'Работа' },
  { name: 'Todoist', url: 'https://todoist.com/', category: 'Работа' },
]
