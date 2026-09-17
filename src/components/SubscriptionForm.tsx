import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  BILLING_PERIOD_LABELS,
  BILLING_PERIODS,
  CURRENCIES,
  CURRENCY_SYMBOLS,
  MAX_CUSTOM_DAYS,
  SERVICE_PRESETS,
  STATUS_LABELS,
  STATUSES,
} from '../constants'
import type { BillingPeriod, Currency, Status, Subscription } from '../types'
import { getDaysUntil, getDueDate, toISODate } from '../utils/dateUtils'
import { formatDate, formatDueText } from '../utils/format'
import { getDisplayHost, MAX_URL_LENGTH, normalizeUrl } from '../utils/logo'
import { LogoError, readLogoFile } from '../utils/logoImage'
import {
  createEmptyDraft,
  DRAFT_FIELD_ORDER,
  draftFromSubscription,
  MAX_CATEGORY_LENGTH,
  MAX_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  validateDraft,
  type DraftErrors,
  type DraftField,
  type SubscriptionDraft,
} from '../utils/validation'
import { ArrowUpRightIcon, CalendarPlusIcon, CheckIcon, ChevronDownIcon, TrashIcon } from './icons'
import { Logo } from './Logo'
import { ReminderPicker } from './ReminderPicker'
import { SegmentedControl, type SegmentOption } from './SegmentedControl'
import { Sheet } from './Sheet'
import styles from './SubscriptionForm.module.css'

export type SubscriptionValue = Omit<Subscription, 'id' | 'paidThrough'>

interface SubscriptionFormProps {
  open: boolean
  /** null — новая подписка. */
  subscription: Subscription | null
  categories: readonly string[]
  today: Date
  onCancel: () => void
  onSave: (value: SubscriptionValue) => void
  onDelete: (subscription: Subscription) => void
  onExport: (subscription: Subscription) => void
  onMarkPaid: (subscription: Subscription) => void
}

const TITLE_ID = 'subscription-form-title'

export function SubscriptionForm({ open, onCancel, ...props }: SubscriptionFormProps) {
  return (
    <Sheet open={open} onClose={onCancel} labelledBy={TITLE_ID}>
      <FormContent onCancel={onCancel} {...props} />
    </Sheet>
  )
}

const CURRENCY_OPTIONS: readonly SegmentOption<Currency>[] = CURRENCIES.map((currency) => ({
  value: currency,
  label: CURRENCY_SYMBOLS[currency],
  ariaLabel: currency,
}))

const STATUS_OPTIONS: readonly SegmentOption<Status>[] = STATUSES.map((status) => ({
  value: status,
  label: status === 'paused' ? 'Пауза' : STATUS_LABELS[status],
}))

function FormContent({
  subscription,
  categories,
  today,
  onCancel,
  onSave,
  onDelete,
  onExport,
  onMarkPaid,
}: Omit<SubscriptionFormProps, 'open'>) {
  const [draft, setDraft] = useState<SubscriptionDraft>(() =>
    subscription ? draftFromSubscription(subscription) : createEmptyDraft(toISODate(today)),
  )
  const [errors, setErrors] = useState<DraftErrors>({})
  const [logoError, setLogoError] = useState<string | null>(null)
  // Значок сайта грузится не на каждую букву, а когда ввод ссылки затих.
  const [previewUrl, setPreviewUrl] = useState(() => normalizeUrl(draft.url))
  const fieldRefs = useRef<Partial<Record<DraftField, HTMLInputElement | null>>>({})
  const uid = useId()
  const id = (field: string) => `${uid}-${field}`

  const update = <K extends keyof SubscriptionDraft>(key: K, value: SubscriptionDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    if (key in errors) {
      setErrors((current) => {
        const next = { ...current }
        delete next[key as DraftField]
        return next
      })
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewUrl(normalizeUrl(draft.url)), 600)
    return () => window.clearTimeout(timer)
  }, [draft.url])

  const handleLogoFile = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    setLogoError(null)
    readLogoFile(file)
      .then((logo) => update('logo', logo))
      .catch((error: unknown) =>
        setLogoError(error instanceof LogoError ? error.message : 'Не получилось загрузить картинку.'),
      )
  }

  const handleSave = () => {
    const result = validateDraft(draft)
    if (!result.ok) {
      setErrors(result.errors)
      const firstInvalid = DRAFT_FIELD_ORDER.find((field) => result.errors[field])
      if (firstInvalid) fieldRefs.current[firstInvalid]?.focus()
      return
    }
    onSave(result.value)
  }

  const errorProps = (field: DraftField) => ({
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? id(`${field}-error`) : undefined,
  })

  const renderError = (field: DraftField) =>
    errors[field] ? (
      <p id={id(`${field}-error`)} className={styles.error}>
        {errors[field]}
      </p>
    ) : null

  const isEdit = subscription !== null
  const active = subscription?.status === 'active'
  const dueDate = subscription ? getDueDate(subscription) : null

  return (
    <div className={styles.form}>
      <header className={styles.header} data-sheet-drag>
        <button type="button" className={styles.headerButton} onClick={onCancel}>
          Отмена
        </button>
        <h2 id={TITLE_ID} className={styles.title}>
          {isEdit ? 'Подписка' : 'Новая подписка'}
        </h2>
        <button type="button" className={`${styles.headerButton} ${styles.done}`} onClick={handleSave}>
          Готово
        </button>
      </header>

      <div className={styles.body}>
        <Group>
          <div className={styles.field}>
            <Logo
              subscription={{ name: draft.name, url: previewUrl ?? undefined, logo: draft.logo ?? undefined }}
              className={styles.fieldLogo}
            />
            <label htmlFor={id('name')} className="visually-hidden">
              Название
            </label>
            <input
              id={id('name')}
              ref={(element) => {
                fieldRefs.current.name = element
              }}
              className={styles.nameInput}
              placeholder="Название, например Кинопоиск"
              autoComplete="off"
              enterKeyHint="next"
              maxLength={MAX_NAME_LENGTH}
              value={draft.name}
              onChange={(event) => update('name', event.target.value)}
              {...errorProps('name')}
            />
          </div>
          {renderError('name')}

          <Row label="Сайт" htmlFor={id('url')}>
            <input
              id={id('url')}
              ref={(element) => {
                fieldRefs.current.url = element
              }}
              type="url"
              inputMode="url"
              className={styles.inlineInput}
              placeholder="kinopoisk.ru"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              maxLength={MAX_URL_LENGTH}
              value={draft.url}
              onChange={(event) => update('url', event.target.value)}
              {...errorProps('url')}
            />
          </Row>
          {renderError('url')}

          <div className={styles.logoActions}>
            <label className={`chip ${styles.logoButton}`}>
              <input type="file" accept="image/*" className="visually-hidden" onChange={handleLogoFile} />
              {draft.logo ? 'Заменить логотип' : 'Свой логотип'}
            </label>
            {draft.logo && (
              <button type="button" className="chip" onClick={() => update('logo', null)}>
                Убрать
              </button>
            )}
          </div>
          {logoError && <p className={styles.error}>{logoError}</p>}
        </Group>
        <p className={styles.hint}>
          Логотип подставится с сайта автоматически. Можно загрузить свою картинку.
        </p>

        {!isEdit && (
          <section className={styles.section} aria-labelledby={id('presets')}>
            <h3 id={id('presets')} className={styles.groupTitle}>
              Популярные сервисы
            </h3>
            <div className={styles.presets}>
              {SERVICE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className={styles.preset}
                  onClick={() => {
                    setDraft((current) => ({
                      ...current,
                      name: preset.name,
                      url: preset.url,
                      category: preset.category,
                      logo: null,
                    }))
                    setPreviewUrl(preset.url)
                    setErrors({})
                  }}
                >
                  <Logo subscription={{ name: preset.name, url: preset.url }} className={styles.presetLogo} />
                  <span className={styles.presetName}>{preset.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <Group title="Оплата">
          <Row label="Сумма" htmlFor={id('price')}>
            <input
              id={id('price')}
              ref={(element) => {
                fieldRefs.current.price = element
              }}
              className={`tabular ${styles.inlineInput}`}
              inputMode="decimal"
              enterKeyHint="next"
              autoComplete="off"
              placeholder="0"
              value={draft.price}
              onChange={(event) => update('price', event.target.value)}
              {...errorProps('price')}
            />
          </Row>
          {renderError('price')}

          <Row label="Валюта" labelId={id('currency')}>
            <SegmentedControl
              ariaLabelledBy={id('currency')}
              size="compact"
              className={styles.currency}
              options={CURRENCY_OPTIONS}
              value={draft.currency}
              onChange={(value) => update('currency', value)}
            />
          </Row>

          <Row label="Дата платежа" htmlFor={id('startDate')}>
            <input
              id={id('startDate')}
              ref={(element) => {
                fieldRefs.current.startDate = element
              }}
              type="date"
              min="1970-01-01"
              max="2100-12-31"
              className={`tabular ${styles.inlineInput} ${styles.dateInput}`}
              value={draft.startDate}
              onChange={(event) => update('startDate', event.target.value)}
              {...errorProps('startDate')}
            />
          </Row>
          {renderError('startDate')}

          <Row label="Повтор" htmlFor={id('billingPeriod')}>
            <span className={styles.selectWrap}>
              <select
                id={id('billingPeriod')}
                className={styles.select}
                value={draft.billingPeriod}
                onChange={(event) => update('billingPeriod', event.target.value as BillingPeriod)}
              >
                {BILLING_PERIODS.map((period) => (
                  <option key={period} value={period}>
                    {BILLING_PERIOD_LABELS[period]}
                  </option>
                ))}
              </select>
              <ChevronDownIcon />
            </span>
          </Row>

          {draft.billingPeriod === 'custom' && (
            <>
              <Row label="Каждые, дней" htmlFor={id('customDays')}>
                <input
                  id={id('customDays')}
                  ref={(element) => {
                    fieldRefs.current.customDays = element
                  }}
                  className={`tabular ${styles.inlineInput}`}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="30"
                  value={draft.customDays}
                  onChange={(event) =>
                    update('customDays', event.target.value.replace(/\D/g, '').slice(0, String(MAX_CUSTOM_DAYS).length))
                  }
                  {...errorProps('customDays')}
                />
              </Row>
              {renderError('customDays')}
            </>
          )}
        </Group>
        <p className={styles.hint}>
          Дата первого или последнего списания. Следующие платежи посчитаются сами.
        </p>

        <Group title="Детали">
          <Row label="Категория" htmlFor={id('category')}>
            <input
              id={id('category')}
              className={styles.inlineInput}
              placeholder="Без категории"
              autoComplete="off"
              maxLength={MAX_CATEGORY_LENGTH}
              value={draft.category}
              onChange={(event) => update('category', event.target.value)}
            />
          </Row>
          {categories.length > 0 && (
            <div className={styles.suggestions} role="group" aria-label="Выбрать категорию">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className="chip"
                  aria-pressed={draft.category.trim().toLocaleLowerCase('ru') === category.toLocaleLowerCase('ru')}
                  onClick={() => update('category', category)}
                >
                  {category}
                </button>
              ))}
            </div>
          )}
          <Row label="Статус" labelId={id('status')}>
            <SegmentedControl
              ariaLabelledBy={id('status')}
              size="compact"
              className={styles.status}
              options={STATUS_OPTIONS}
              value={draft.status}
              onChange={(value) => update('status', value)}
            />
          </Row>
        </Group>

        <Group title="Напоминания" titleId={id('reminders')}>
          <ReminderPicker
            labelledBy={id('reminders')}
            value={draft.reminders}
            onChange={(value) => update('reminders', value)}
          />
        </Group>
        <p className={styles.hint}>Сработают в календаре после экспорта в .ics.</p>

        <Group title="Заметки" titleId={id('notes-title')}>
          <textarea
            className={styles.notes}
            aria-labelledby={id('notes-title')}
            rows={3}
            maxLength={MAX_NOTES_LENGTH}
            placeholder="Например: семейный тариф, оплата с карты …1234"
            value={draft.notes}
            onChange={(event) => update('notes', event.target.value)}
          />
        </Group>

        {subscription && (
          <Group>
            {active && dueDate && (
              <button type="button" className={styles.action} onClick={() => onMarkPaid(subscription)}>
                <span className={styles.actionText}>
                  Отметить оплату
                  <span className={styles.actionHint}>
                    Срок: {formatDate(dueDate, today)}, {formatDueText(getDaysUntil(dueDate, today))}
                  </span>
                </span>
                <CheckIcon />
              </button>
            )}
            {subscription.url && (
              <a className={styles.action} href={subscription.url} target="_blank" rel="noopener noreferrer">
                <span className={styles.actionText}>
                  Открыть сайт
                  <span className={styles.actionHint}>{getDisplayHost(subscription.url)}</span>
                </span>
                <ArrowUpRightIcon />
              </a>
            )}
            <button type="button" className={styles.action} onClick={() => onExport(subscription)}>
              <span className={styles.actionText}>Добавить в календарь</span>
              <CalendarPlusIcon />
            </button>
            <button
              type="button"
              className={`${styles.action} ${styles.destructive}`}
              onClick={() => onDelete(subscription)}
            >
              <span className={styles.actionText}>Удалить подписку</span>
              <TrashIcon />
            </button>
          </Group>
        )}
      </div>
    </div>
  )
}

function Group({ title, titleId, children }: { title?: string; titleId?: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      {title && (
        <h3 id={titleId} className={styles.groupTitle}>
          {title}
        </h3>
      )}
      <div className={styles.group}>{children}</div>
    </section>
  )
}

type RowProps = { label: string; children: ReactNode } & (
  | { htmlFor: string; labelId?: never }
  | { labelId: string; htmlFor?: never }
)

function Row({ label, htmlFor, labelId, children }: RowProps) {
  return (
    <div className={styles.row}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={styles.rowLabel}>
          {label}
        </label>
      ) : (
        <span id={labelId} className={styles.rowLabel}>
          {label}
        </span>
      )}
      <div className={styles.rowControl}>{children}</div>
    </div>
  )
}
