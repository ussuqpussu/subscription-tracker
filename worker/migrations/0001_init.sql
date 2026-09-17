-- Устройства с активной подпиской Web Push.
CREATE TABLE devices (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  last_test_at INTEGER
);

-- Запланированные напоминания. Приложение заменяет весь список устройства при каждой синхронизации.
CREATE TABLE reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL REFERENCES devices (endpoint) ON DELETE CASCADE,
  at INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tag TEXT NOT NULL
);

CREATE INDEX reminders_at ON reminders (at);
CREATE INDEX reminders_endpoint ON reminders (endpoint);
