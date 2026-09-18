import type { CSSProperties } from 'react'
import { ACCENTS, type AccentId, type ThemeMode } from '../constants'
import styles from './AppearanceSheet.module.css'
import { CheckIcon } from './icons'
import { SegmentedControl, type SegmentOption } from './SegmentedControl'
import { Sheet } from './Sheet'

const TITLE_ID = 'appearance-title'

const THEME_OPTIONS: readonly SegmentOption<ThemeMode>[] = [
  { value: 'auto', label: 'Авто' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
]

interface AppearanceSheetProps {
  open: boolean
  onClose: () => void
  theme: ThemeMode
  onThemeChange: (theme: ThemeMode) => void
  accent: AccentId
  onAccentChange: (accent: AccentId) => void
}

/** Оформление: тема (Авто / Светлая / Тёмная) и акцентная палитра приложения. */
export function AppearanceSheet({
  open,
  onClose,
  theme,
  onThemeChange,
  accent,
  onAccentChange,
}: AppearanceSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy={TITLE_ID}>
      <div className={styles.sheet}>
        <header className={styles.header} data-sheet-drag>
          <h2 id={TITLE_ID} className={styles.title}>
            Оформление
          </h2>
          <button type="button" className={styles.done} data-autofocus onClick={onClose}>
            Готово
          </button>
        </header>

        <div className={styles.body}>
          <section className={styles.section} aria-labelledby="appearance-theme">
            <h3 id="appearance-theme" className={styles.groupTitle}>
              Тема
            </h3>
            <SegmentedControl
              className="glass"
              ariaLabelledBy="appearance-theme"
              options={THEME_OPTIONS}
              value={theme}
              onChange={onThemeChange}
            />
            <p className={styles.note}>«Авто» переключает тему вслед за настройками устройства.</p>
          </section>

          <section className={styles.section} aria-labelledby="appearance-accent">
            <h3 id="appearance-accent" className={styles.groupTitle}>
              Цвет
            </h3>
            <div className={styles.palette} role="radiogroup" aria-labelledby="appearance-accent">
              {ACCENTS.map((palette) => (
                <button
                  key={palette.id}
                  type="button"
                  role="radio"
                  aria-checked={palette.id === accent}
                  className={styles.swatch}
                  style={{ '--swatch-accent': palette.color, '--swatch-grad': palette.gradient } as CSSProperties}
                  onClick={() => onAccentChange(palette.id)}
                >
                  <span className={styles.chip} aria-hidden="true">
                    {palette.id === accent && <CheckIcon className={styles.check} />}
                  </span>
                  <span className={styles.swatchLabel}>{palette.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </Sheet>
  )
}
