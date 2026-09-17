import { useId, useState } from 'react'
import type { SyncState } from '../hooks/useSync'
import { createSyncCode, normalizeSyncCode } from '../utils/sync'
import { isSyncAvailable } from '../utils/syncApi'
import { CheckIcon, CloudIcon } from './icons'
import styles from './SyncSheet.module.css'
import { Sheet } from './Sheet'

const TITLE_ID = 'sync-title'

export interface SyncMessage {
  text: string
  tone: 'default' | 'error'
}

interface SyncSheetProps {
  open: boolean
  onClose: () => void
  state: SyncState | null
  busy: boolean
  message: SyncMessage | null
  /** Включает синхронизацию с новым кодом или подключается к существующему. */
  onConnect: (code: string) => void
  onDisconnect: () => void
}

/** Синхронизация между устройствами по секретному коду. */
export function SyncSheet({ open, onClose, state, busy, message, onConnect, onDisconnect }: SyncSheetProps) {
  const [entered, setEntered] = useState('')
  const [copied, setCopied] = useState(false)
  const inputId = useId()
  const enteredCode = normalizeSyncCode(entered)

  const copyCode = () => {
    if (!state) return
    navigator.clipboard
      ?.writeText(state.code)
      .then(() => setCopied(true))
      .catch(() => setCopied(false))
  }

  return (
    <Sheet open={open} onClose={onClose} labelledBy={TITLE_ID}>
      <div className={styles.sheet}>
        <header className={styles.header} data-sheet-drag>
          <h2 id={TITLE_ID} className={styles.title}>
            Синхронизация
          </h2>
          <button type="button" className={styles.close} data-autofocus onClick={onClose}>
            Готово
          </button>
        </header>

        <div className={styles.body}>
          {!isSyncAvailable ? (
            <p className={styles.hint}>Сервер синхронизации не настроен в этой сборке приложения.</p>
          ) : state ? (
            <>
              <section className={styles.section}>
                <div className={styles.group}>
                  <div className={styles.row}>
                    <span className={styles.rowIcon} aria-hidden="true">
                      <CloudIcon />
                    </span>
                    <span className={styles.rowLabel}>Включена</span>
                  </div>
                  <p className={styles.code}>{state.code}</p>
                  <button type="button" className={styles.action} onClick={copyCode}>
                    {copied ? 'Код скопирован' : 'Скопировать код'}
                    {copied && <CheckIcon />}
                  </button>
                </div>
                <p className={styles.hint}>
                  Введите этот код на другом устройстве — списки объединятся. Код заменяет пароль: кто его знает, тот
                  видит подписки. Потеряете код — данные с сервера не восстановить.
                </p>
              </section>

              <section className={styles.section}>
                <div className={styles.group}>
                  <button
                    type="button"
                    className={`${styles.action} ${styles.destructive}`}
                    disabled={busy}
                    onClick={onDisconnect}
                  >
                    Выключить на этом устройстве
                  </button>
                </div>
                <p className={styles.hint}>Подписки останутся на телефоне, обмен с сервером прекратится.</p>
              </section>
            </>
          ) : (
            <>
              <section className={styles.section}>
                <div className={styles.group}>
                  <button
                    type="button"
                    className={styles.action}
                    disabled={busy}
                    onClick={() => onConnect(createSyncCode())}
                  >
                    Включить синхронизацию
                    <CloudIcon />
                  </button>
                </div>
                <p className={styles.hint}>
                  Приложение выдаст код и будет держать подписки на сервере в зашифрованном виде. Названия и суммы
                  видны только вашим устройствам.
                </p>
              </section>

              <section className={styles.section}>
                <label htmlFor={inputId} className={styles.groupTitle}>
                  Подключить другое устройство
                </label>
                <div className={styles.group}>
                  <input
                    id={inputId}
                    className={styles.input}
                    placeholder="Код с первого устройства"
                    autoComplete="off"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    value={entered}
                    onChange={(event) => setEntered(event.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.action}
                    disabled={busy || enteredCode === null}
                    onClick={() => enteredCode && onConnect(enteredCode)}
                  >
                    Подключить
                  </button>
                </div>
                <p className={styles.hint}>Подписки этого устройства заменятся списком с сервера.</p>
              </section>
            </>
          )}

          <p className={styles.message} role="status" data-tone={message?.tone}>
            {message?.text}
          </p>
        </div>
      </div>
    </Sheet>
  )
}
