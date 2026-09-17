import type { Subscription } from '../types'
import { formatMoney } from '../utils/format'
import type { Rates } from '../utils/rates'
import { getCategoryShares, NO_CATEGORY } from '../utils/stats'
import { filterSubscriptions, type StatusFilter } from '../utils/subscriptionUtils'
import styles from './FiltersSheet.module.css'
import { CheckIcon, ListIcon } from './icons'
import { Logo } from './Logo'
import { SegmentedControl, type SegmentOption } from './SegmentedControl'
import { Sheet } from './Sheet'

const TITLE_ID = 'filters-title'

/** Столько логотипов помещается в строке категории. */
const MAX_LOGOS = 3

const STATUS_OPTIONS: readonly SegmentOption<StatusFilter>[] = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'paused', label: 'Пауза' },
  { value: 'cancelled', label: 'Отменены' },
]

interface FiltersSheetProps {
  open: boolean
  onClose: () => void
  subscriptions: readonly Subscription[]
  rates: Rates | null
  status: StatusFilter
  onStatusChange: (status: StatusFilter) => void
  categories: readonly string[]
  category: string | null
  onCategoryChange: (category: string | null) => void
  onReset: () => void
}

/** Фильтры списка: статус и категория с числом подписок и тратами в месяц. */
export function FiltersSheet({
  open,
  onClose,
  subscriptions,
  rates,
  status,
  onStatusChange,
  categories,
  category,
  onCategoryChange,
  onReset,
}: FiltersSheetProps) {
  const amounts = new Map(getCategoryShares(subscriptions, rates).map((share) => [share.category, share.amount]))
  const matching = (value: string | null) => filterSubscriptions(subscriptions, { status, category: value })
  // В строке категории показываем логотипы первых подписок из неё.
  const logosFor = (value: string | null) => matching(value).slice(0, MAX_LOGOS)
  const active = status !== 'all' || category !== null

  return (
    <Sheet open={open} onClose={onClose} labelledBy={TITLE_ID}>
      <div className={styles.sheet}>
        <header className={styles.header} data-sheet-drag>
          <button type="button" className={styles.reset} disabled={!active} onClick={onReset}>
            Сбросить
          </button>
          <h2 id={TITLE_ID} className={styles.title}>
            Фильтры
          </h2>
          <button type="button" className={`${styles.reset} ${styles.done}`} data-autofocus onClick={onClose}>
            Готово
          </button>
        </header>

        <div className={styles.body}>
          <section className={styles.section} aria-labelledby="filters-status">
            <h3 id="filters-status" className={styles.groupTitle}>
              Статус
            </h3>
            <SegmentedControl
              className="glass"
              ariaLabelledBy="filters-status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={onStatusChange}
            />
          </section>

          <section className={styles.section} aria-labelledby="filters-categories">
            <h3 id="filters-categories" className={styles.groupTitle}>
              Категория
            </h3>
            <div className={styles.group} role="group" aria-labelledby="filters-categories">
              <button
                type="button"
                className={styles.row}
                aria-pressed={category === null}
                onClick={() => onCategoryChange(null)}
              >
                <span className={styles.logos} aria-hidden="true">
                  {logosFor(null).length > 0 ? (
                    logosFor(null).map((item) => (
                      <Logo key={item.id} subscription={item} className={styles.logo} />
                    ))
                  ) : (
                    <span className={styles.emptyLogo}>
                      <ListIcon />
                    </span>
                  )}
                </span>
                <span className={styles.rowText}>
                  <span className={styles.rowLabel}>Все категории</span>
                  <span className={styles.rowMeta}>{matching(null).length} в списке</span>
                </span>
                {category === null && <CheckIcon className={styles.check} />}
              </button>

              {categories.map((item) => {
                const amount = amounts.get(item) ?? amounts.get(item.trim() || NO_CATEGORY) ?? 0
                return (
                  <button
                    key={item}
                    type="button"
                    className={styles.row}
                    aria-pressed={category === item}
                    onClick={() => onCategoryChange(category === item ? null : item)}
                  >
                    <span className={styles.logos} aria-hidden="true">
                      {logosFor(item).map((subscription) => (
                        <Logo key={subscription.id} subscription={subscription} className={styles.logo} />
                      ))}
                    </span>
                    <span className={styles.rowText}>
                      <span className={styles.rowLabel}>{item}</span>
                      <span className={`tabular ${styles.rowMeta}`}>
                        {matching(item).length} · {formatMoney(amount, 'RUB')} в месяц
                      </span>
                    </span>
                    {category === item && <CheckIcon className={styles.check} />}
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </Sheet>
  )
}
