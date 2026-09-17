import { PUSH_REMINDER_HOUR } from '../utils/pushReminders'
import type { PushState } from '../utils/push'
import { BellIcon, CalendarPlusIcon } from './icons'
import styles from './NotificationsSheet.module.css'
import { Sheet } from './Sheet'
import { Switch } from './Switch'

const TITLE_ID = 'notifications-title'

const STATE_TEXT: Record<Exclude<PushState, 'unconfigured'>, string> = {
  on: 'Включены на этом устройстве.',
  off: 'Выключены.',
  denied: 'Уведомления запрещены. Разрешите их в Настройках → Уведомления → Подписки.',
  'needs-install':
    'На iPhone пуши работают, только если открыть приложение с экрана «Домой»: в Safari нажмите «Поделиться» → «На экран «Домой»». Нужна iOS 16.4 или новее.',
  unsupported: 'Этот браузер не поддерживает пуш-уведомления.',
}

export interface PushMessage {
  text: string
  tone: 'default' | 'error'
}

interface NotificationsSheetProps {
  open: boolean
  onClose: () => void
  pushState: PushState
  busy: boolean
  /** Итог последнего действия. Показывается внутри окна: toast под модальным окном не виден. */
  message: PushMessage | null
  onPushToggle: (enabled: boolean) => void
  onTestPush: () => void
  onExportAll: () => void
  exportDisabled: boolean
}

export function NotificationsSheet({
  open,
  onClose,
  pushState,
  busy,
  message,
  onPushToggle,
  onTestPush,
  onExportAll,
  exportDisabled,
}: NotificationsSheetProps) {
  const canToggle = pushState === 'on' || pushState === 'off'

  return (
    <Sheet open={open} onClose={onClose} labelledBy={TITLE_ID}>
      <div className={styles.sheet}>
        <header className={styles.header}>
          <span className={styles.grabber} aria-hidden="true" />
          <h2 id={TITLE_ID} className={styles.title}>
            Уведомления
          </h2>
          <button type="button" className={styles.close} data-autofocus onClick={onClose}>
            Готово
          </button>
        </header>

        <div className={styles.body}>
          {pushState !== 'unconfigured' && (
            <section className={styles.section}>
              <div className={styles.group}>
                <div className={styles.row}>
                  <span className={styles.rowIcon} aria-hidden="true">
                    <BellIcon />
                  </span>
                  <span id="push-switch-label" className={styles.rowLabel}>
                    Пуш-уведомления
                  </span>
                  <Switch
                    checked={pushState === 'on'}
                    disabled={!canToggle || busy}
                    labelledBy="push-switch-label"
                    describedBy="push-switch-state"
                    onChange={onPushToggle}
                  />
                </div>
                <p id="push-switch-state" className={styles.state} data-state={pushState}>
                  {STATE_TEXT[pushState]}
                </p>
                <p className={styles.message} role="status" data-tone={message?.tone}>
                  {message?.text}
                </p>
                {pushState === 'on' && (
                  <button type="button" className={styles.action} disabled={busy} onClick={onTestPush}>
                    Отправить тестовое уведомление
                  </button>
                )}
              </div>
              <p className={styles.hint}>
                Приходят в {PUSH_REMINDER_HOUR}:00 за столько дней до платежа, сколько выбрано в подписке. Для этого
                название, сумма и дата платежа хранятся на сервере уведомлений.
              </p>
            </section>
          )}

          <section className={styles.section}>
            <div className={styles.group}>
              <button type="button" className={styles.action} disabled={exportDisabled} onClick={onExportAll}>
                Все подписки в календарь
                <CalendarPlusIcon />
              </button>
            </div>
            <p className={styles.hint}>Напоминания из календаря (.ics) работают без интернета и сервера.</p>
          </section>
        </div>
      </div>
    </Sheet>
  )
}
