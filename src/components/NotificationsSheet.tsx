import { useId } from 'react'
import type { PushState } from '../utils/push'
import type { ReminderSettings } from '../utils/pushReminders'
import { BellIcon, CalendarPlusIcon, ChevronDownIcon } from './icons'
import styles from './NotificationsSheet.module.css'
import { Sheet } from './Sheet'
import { Switch } from './Switch'

const TITLE_ID = 'notifications-title'

/** Часы на выбор: «0:00» … «23:00». */
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

const formatHour = (hour: number) => `${hour}:00`

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
  settings: ReminderSettings
  onSettingsChange: (settings: ReminderSettings) => void
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
  settings,
  onSettingsChange,
  onPushToggle,
  onTestPush,
  onExportAll,
  exportDisabled,
}: NotificationsSheetProps) {
  const canToggle = pushState === 'on' || pushState === 'off'
  const uid = useId()
  const id = (field: string) => `${uid}-${field}`
  const update = (patch: Partial<ReminderSettings>) => onSettingsChange({ ...settings, ...patch })

  const quietHint = settings.quietEnabled
    ? `Напоминания приходят в ${formatHour(settings.hour)}. Попавшие в тишину подождут до ${formatHour(settings.quietEnd)}.`
    : `Напоминания приходят в ${formatHour(settings.hour)} по времени устройства.`

  return (
    <Sheet open={open} onClose={onClose} labelledBy={TITLE_ID}>
      <div className={styles.sheet}>
        <header className={styles.header} data-sheet-drag>
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
                Приходят за столько дней до платежа, сколько выбрано в подписке. Для этого название, сумма и дата
                платежа хранятся на сервере уведомлений.
              </p>
            </section>
          )}

          {pushState !== 'unconfigured' && (
            <section className={styles.section}>
              <div className={styles.group}>
                <div className={styles.row}>
                  <label htmlFor={id('hour')} className={styles.rowLabel}>
                    Время напоминаний
                  </label>
                  <span className="select-field">
                    <select
                      id={id('hour')}
                      value={settings.hour}
                      onChange={(event) => update({ hour: Number(event.target.value) })}
                    >
                      {HOURS.map((hour) => (
                        <option key={hour} value={hour}>
                          {formatHour(hour)}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon />
                  </span>
                </div>

                <div className={styles.row}>
                  <span id={id('quiet')} className={styles.rowLabel}>
                    Не беспокоить ночью
                  </span>
                  <Switch
                    checked={settings.quietEnabled}
                    labelledBy={id('quiet')}
                    onChange={(checked) => update({ quietEnabled: checked })}
                  />
                </div>

                {settings.quietEnabled && (
                  <>
                    <div className={styles.row}>
                      <label htmlFor={id('quietStart')} className={styles.rowLabel}>
                        Тишина с
                      </label>
                      <span className="select-field">
                        <select
                          id={id('quietStart')}
                          value={settings.quietStart}
                          onChange={(event) => update({ quietStart: Number(event.target.value) })}
                        >
                          {HOURS.map((hour) => (
                            <option key={hour} value={hour}>
                              {formatHour(hour)}
                            </option>
                          ))}
                        </select>
                        <ChevronDownIcon />
                      </span>
                    </div>

                    <div className={styles.row}>
                      <label htmlFor={id('quietEnd')} className={styles.rowLabel}>
                        Тишина до
                      </label>
                      <span className="select-field">
                        <select
                          id={id('quietEnd')}
                          value={settings.quietEnd}
                          onChange={(event) => update({ quietEnd: Number(event.target.value) })}
                        >
                          {HOURS.map((hour) => (
                            <option key={hour} value={hour}>
                              {formatHour(hour)}
                            </option>
                          ))}
                        </select>
                        <ChevronDownIcon />
                      </span>
                    </div>
                  </>
                )}
              </div>
              <p className={styles.hint}>{quietHint}</p>
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
