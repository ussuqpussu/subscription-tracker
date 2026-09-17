import { makeDate } from '../utils/dateUtils'
import { formatMoney } from '../utils/format'
import type { Rates } from '../utils/rates'
import { getCategoryShares, getSpent, getTips, type CategoryShare } from '../utils/stats'
import type { Subscription } from '../types'
import { Sheet } from './Sheet'
import styles from './StatsSheet.module.css'

const TITLE_ID = 'stats-title'

/** Цвета долей: повторяются по кругу, если категорий больше. */
const COLORS = ['#ffb4a2', '#5e9cff', '#30d158', '#ffd60a', '#bf8cff', '#ff6f91', '#6fd3d6']

interface StatsSheetProps {
  open: boolean
  onClose: () => void
  subscriptions: readonly Subscription[]
  today: Date
  rates: Rates | null
}

/** Статистика: на что уходят деньги, сколько оплачено и что стоит проверить. */
export function StatsSheet({ open, onClose, subscriptions, today, rates }: StatsSheetProps) {
  const shares = getCategoryShares(subscriptions, rates)
  const tips = getTips(subscriptions, today, rates)
  const monthStart = makeDate(today.getFullYear(), today.getMonth(), 1)
  const yearStart = makeDate(today.getFullYear(), 0, 1)
  const spentMonth = getSpent(subscriptions, rates, monthStart, today)
  const spentYear = getSpent(subscriptions, rates, yearStart, today)
  const total = shares.reduce((sum, item) => sum + item.amount, 0)

  // Кольцо рисуется одной окружностью: каждая доля — свой отрезок штриха со смещением.
  const segments = shares.reduce<(CategoryShare & { color: string; offset: number })[]>((acc, item, index) => {
    const previous = acc[index - 1]
    const offset = previous ? previous.offset + previous.share : 0
    acc.push({ ...item, color: COLORS[index % COLORS.length], offset })
    return acc
  }, [])

  return (
    <Sheet open={open} onClose={onClose} labelledBy={TITLE_ID}>
      <div className={styles.sheet}>
        <header className={styles.header} data-sheet-drag>
          <h2 id={TITLE_ID} className={styles.title}>
            Статистика
          </h2>
          <button type="button" className={styles.close} data-autofocus onClick={onClose}>
            Готово
          </button>
        </header>

        <div className={styles.body}>
          <section className={`card ${styles.card}`} aria-labelledby="stats-spent">
            <h3 id="stats-spent" className={styles.cardTitle}>
              Оплачено
            </h3>
            <div className={styles.spent}>
              <p className={styles.spentItem}>
                <span className={styles.spentLabel}>В этом месяце</span>
                <span className={`tabular ${styles.spentValue}`}>{formatMoney(spentMonth, 'RUB')}</span>
              </p>
              <p className={styles.spentItem}>
                <span className={styles.spentLabel}>С начала года</span>
                <span className={`tabular ${styles.spentValue}`}>{formatMoney(spentYear, 'RUB')}</span>
              </p>
            </div>
            <p className={styles.hint}>Считается по нажатиям «Оплачено», поэтому учитывает только отмеченные платежи.</p>
          </section>

          {segments.length > 0 && (
            <section className={`card ${styles.card}`} aria-labelledby="stats-categories">
              <h3 id="stats-categories" className={styles.cardTitle}>
                На что уходит в месяц
              </h3>
              <div className={styles.chart}>
                <svg viewBox="0 0 42 42" className={styles.donut} role="img" aria-label="Доли категорий">
                  <circle className={styles.donutTrack} cx="21" cy="21" r="15.9" />
                  {segments.map((segment) => (
                    <circle
                      key={segment.category}
                      cx="21"
                      cy="21"
                      r="15.9"
                      className={styles.donutSegment}
                      stroke={segment.color}
                      strokeDasharray={`${segment.share * 100} ${100 - segment.share * 100}`}
                      strokeDashoffset={`${25 - segment.offset * 100}`}
                    />
                  ))}
                </svg>
                <p className={`tabular ${styles.donutTotal}`}>{formatMoney(total, 'RUB')}</p>
              </div>
              <ul className={styles.legend}>
                {segments.map((segment) => (
                  <li key={segment.category} className={styles.legendItem}>
                    <span className={styles.dot} style={{ background: segment.color }} aria-hidden="true" />
                    <span className={styles.legendName}>{segment.category}</span>
                    <span className={`tabular ${styles.legendValue}`}>
                      {formatMoney(segment.amount, 'RUB')} · {Math.round(segment.share * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tips.length > 0 && (
            <section className={styles.tips} aria-labelledby="stats-tips">
              <h3 id="stats-tips" className={styles.cardTitle}>
                Стоит проверить
              </h3>
              <ul className={styles.tipList}>
                {tips.map((tip) => (
                  <li key={tip.id} className={`card ${styles.tip}`} data-tone={tip.tone}>
                    {tip.text}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </Sheet>
  )
}
