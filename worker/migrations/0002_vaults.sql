-- Шифрованные копии подписок для синхронизации между устройствами.
-- id выводится из кода на устройстве; ключ шифрования сюда не попадает.
CREATE TABLE vaults (
  id TEXT PRIMARY KEY,
  blob TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
