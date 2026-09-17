/** Адрес сервера приложения (пуши, логотипы). Задаётся при сборке в .env.production; пусто — сервера нет. */
export const API_URL = String(import.meta.env.VITE_PUSH_API_URL ?? '').replace(/\/+$/, '')
