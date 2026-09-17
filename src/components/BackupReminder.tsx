import { ArrowDownDocIcon } from './icons'
import styles from './BackupReminder.module.css'

interface BackupReminderProps {
  onBackup: () => void
  onSnooze: () => void
}

/** Напоминание о резервной копии: данные живут только на устройстве и пропадут вместе с иконкой. */
export function BackupReminder({ onBackup, onSnooze }: BackupReminderProps) {
  return (
    <section className={`card ${styles.reminder}`} aria-labelledby="backup-reminder-title">
      <h2 id="backup-reminder-title" className={styles.title}>
        Данные только на этом устройстве
      </h2>
      <p className={styles.text}>
        iOS удалит подписки, если убрать иконку с экрана «Домой». Сохраните копию или включите синхронизацию.
      </p>
      <div className={styles.actions}>
        <button type="button" className="button button-primary" onClick={onBackup}>
          <ArrowDownDocIcon />
          Сохранить копию
        </button>
        <button type="button" className="button" onClick={onSnooze}>
          Позже
        </button>
      </div>
    </section>
  )
}
