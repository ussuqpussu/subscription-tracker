import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import styles from './App.module.css'
import { BackupReminder } from './components/BackupReminder'
import { BottomBar, type AppTab } from './components/BottomBar'
import { CalendarView } from './components/CalendarView'
import { ConfirmSheet, type ConfirmRequest } from './components/ConfirmSheet'
import { EmptyState } from './components/EmptyState'
import { FiltersSheet } from './components/FiltersSheet'
import { ArrowDownDocIcon, ArrowUpDocIcon, CalendarPlusIcon, CloudIcon, TrashIcon } from './components/icons'
import type { MenuItem } from './components/MoreMenu'
import { NavBar } from './components/NavBar'
import { NextPayment } from './components/NextPayment'
import { NotificationsSheet, type PushMessage } from './components/NotificationsSheet'
import { SearchField } from './components/SearchField'
import { StatsView } from './components/StatsView'
import { SyncSheet, type SyncMessage } from './components/SyncSheet'
import { SubscriptionForm, type SubscriptionValue } from './components/SubscriptionForm'
import { SubscriptionList } from './components/SubscriptionList'
import { SummaryBar } from './components/SummaryBar'
import { Toast, type ToastMessage } from './components/Toast'
import { HIDE_AMOUNTS_KEY, LAST_BACKUP_KEY, STORAGE_KEY } from './constants'
import { useLocalStorage } from './hooks/useLocalStorage'
import { usePushSync } from './hooks/usePushSync'
import { useRates } from './hooks/useRates'
import { useSync } from './hooks/useSync'
import { useToday } from './hooks/useToday'
import { subscriptionsReducer, type SubscriptionsAction } from './state/subscriptionsReducer'
import type { Subscription } from './types'
import { backupFileName, createBackup, parseBackup } from './utils/backup'
import { getDueDate } from './utils/dateUtils'
import { shareOrDownload, type ShareFile } from './utils/fileShare'
import { formatDate, formatSubscriptionCount } from './utils/format'
import { createAllSubscriptionsIcs, createSubscriptionIcs, icsFileName } from './utils/icsUtils'
import { createId } from './utils/id'
import {
  disablePush,
  enablePush,
  getPushState,
  isPushConfigured,
  PushError,
  sendTestPush,
  type PushState,
} from './utils/push'
import { normalizeSubscriptions } from './utils/subscriptionSchema'
import { deleteVault, isSyncAvailable } from './utils/syncApi'
import {
  collectCategories,
  filterSubscriptions,
  countOverdue,
  isActive,
  markPaid,
  sortSubscriptions,
  type StatusFilter,
} from './utils/subscriptionUtils'

type EditorState = { mode: 'create' } | { mode: 'edit'; id: string } | null

const parseStoredSubscriptions = (raw: unknown) => normalizeSubscriptions(raw).items
const parseStoredFlag = (raw: unknown) => raw === true

/** Через столько без копии показываем напоминание, «Позже» откладывает на неделю. */
const BACKUP_REMINDER_MS = 30 * 24 * 60 * 60 * 1000
const BACKUP_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000

const pushErrorText = (error: unknown) =>
  error instanceof PushError ? error.message : 'Не получилось. Попробуйте ещё раз.'

export default function App() {
  const [subscriptions, setSubscriptions] = useLocalStorage<Subscription[]>(
    STORAGE_KEY,
    [],
    parseStoredSubscriptions,
  )
  const dispatch = useCallback(
    (action: SubscriptionsAction) => setSubscriptions((state) => subscriptionsReducer(state, action)),
    [setSubscriptions],
  )
  const today = useToday()

  const [hideAmounts, setHideAmounts] = useLocalStorage(HIDE_AMOUNTS_KEY, false, parseStoredFlag)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [editor, setEditor] = useState<EditorState>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [tab, setTab] = useState<AppTab>('home')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncMessage, setSyncMessage] = useState<SyncMessage | null>(null)
  const [lastBackupAt, setLastBackupAt] = useLocalStorage<number>(LAST_BACKUP_KEY, 0, (raw) =>
    typeof raw === 'number' ? raw : 0,
  )
  const [pushState, setPushState] = useState<PushState>(isPushConfigured ? 'off' : 'unconfigured')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMessage, setPushMessage] = useState<PushMessage | null>(null)
  const restoreInputRef = useRef<HTMLInputElement>(null)

  const categories = useMemo(() => collectCategories(subscriptions), [subscriptions])
  // Если категорию удалили или переименовали, фильтр по ней молча сбрасывается.
  const activeCategory = categoryFilter !== null && categories.includes(categoryFilter) ? categoryFilter : null
  const filtersActive = statusFilter !== 'all' || activeCategory !== null
  const visibleSubscriptions = useMemo(
    () =>
      sortSubscriptions(
        filterSubscriptions(subscriptions, { status: statusFilter, category: activeCategory, query: searchQuery }),
        today,
      ),
    [subscriptions, statusFilter, activeCategory, searchQuery, today],
  )

  // Курс нужен, только если есть активные подписки не в рублях.
  const rates = useRates(
    subscriptions.some((item) => isActive(item) && item.currency !== 'RUB'),
    today,
  )

  const showSyncError = useCallback((text: string) => setSyncMessage({ text, tone: 'error' }), [])
  const sync = useSync(subscriptions, setSubscriptions, today, showSyncError)

  // Копию просим раз в месяц и только пока синхронизация выключена.
  const needsBackup =
    subscriptions.length > 0 && sync.state === null && today.getTime() - lastBackupAt > BACKUP_REMINDER_MS

  const handleSyncConnect = (code: string) => {
    setSyncBusy(true)
    setSyncMessage(null)
    sync
      .resolve(code)
      .then(async (next) => {
        // На сервере уже есть список — забираем его, иначе выгружаем свой.
        const restored = await sync.pull(next)
        if (!restored) await sync.push(next, subscriptions)
        sync.setState(next)
        setSyncMessage({
          text: restored ? 'Подписки загружены с сервера.' : 'Синхронизация включена.',
          tone: 'default',
        })
      })
      .catch((error: unknown) =>
        setSyncMessage({
          text: error instanceof Error ? error.message : 'Не удалось включить синхронизацию.',
          tone: 'error',
        }),
      )
      .finally(() => setSyncBusy(false))
  }

  const handleSyncDisconnect = () => {
    const current = sync.state
    sync.setState(null)
    setSyncMessage({ text: 'Синхронизация выключена на этом устройстве.', tone: 'default' })
    if (current) void deleteVault(current.vaultId)
  }

  const overdueCount = countOverdue(subscriptions, today)

  // Число просроченных платежей на иконке приложения (iOS 16.4+, установленное приложение).
  useEffect(() => {
    const badge = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    const request = overdueCount > 0 ? badge.setAppBadge?.(overdueCount) : badge.clearAppBadge?.()
    request?.catch(() => undefined)
  }, [overdueCount])

  const refreshPushState = useCallback(() => {
    getPushState()
      .then(setPushState)
      .catch(() => undefined)
  }, [])
  useEffect(refreshPushState, [refreshPushState])
  usePushSync(subscriptions, today, pushState === 'on')

  const editing = editor?.mode === 'edit' ? (subscriptions.find((item) => item.id === editor.id) ?? null) : null
  const formOpen = editor?.mode === 'create' || editing !== null

  const showToast = useCallback((text: string, options: Omit<ToastMessage, 'id' | 'text'> = {}) => {
    setToast({ id: Date.now(), text, ...options })
  }, [])
  const dismissToast = useCallback(() => setToast(null), [])

  const resetFilters = () => {
    setStatusFilter('all')
    setCategoryFilter(null)
    setSearchQuery('')
  }

  const shareFile = (file: ShareFile, downloadedMessage: string) => {
    shareOrDownload(file)
      .then((outcome) => {
        if (outcome === 'downloaded') showToast(downloadedMessage)
      })
      .catch(() => showToast('Не получилось подготовить файл.', { tone: 'error' }))
  }

  const handleSave = (value: SubscriptionValue) => {
    if (editing) {
      dispatch({ type: 'update', subscription: { ...value, id: editing.id }, today })
    } else {
      dispatch({ type: 'add', subscription: { ...value, id: createId() }, today })
    }
    setEditor(null)
  }

  const handleMarkPaid = (subscription: Subscription) => {
    const previousPaidThrough = subscription.paidThrough
    const nextDue = getDueDate(markPaid(subscription))
    dispatch({ type: 'markPaid', id: subscription.id })
    showToast(`«${subscription.name}» оплачена. Следующий платёж — ${formatDate(nextDue, today)}.`, {
      actionLabel: 'Отменить',
      onAction: () => dispatch({ type: 'setPaidThrough', id: subscription.id, paidThrough: previousPaidThrough }),
    })
  }

  const handleExport = (subscription: Subscription) => {
    shareFile(
      {
        name: icsFileName(subscription.name),
        type: 'text/calendar',
        content: createSubscriptionIcs(subscription, { now: new Date(), today }),
      },
      'Файл .ics сохранён. Откройте его, чтобы добавить платежи в календарь.',
    )
  }

  const handleExportAll = () => {
    const active = subscriptions.filter(isActive)
    if (active.length === 0) {
      showToast('Нет активных подписок для экспорта.')
      return
    }
    shareFile(
      {
        name: 'Подписки.ics',
        type: 'text/calendar',
        content: createAllSubscriptionsIcs(active, { now: new Date(), today }),
      },
      `В файл .ics попали ${formatSubscriptionCount(active.length)}.`,
    )
  }

  const handleBackup = () => {
    shareFile(
      { name: backupFileName(), type: 'application/json', content: createBackup(subscriptions) },
      'Резервная копия сохранена.',
    )
    setLastBackupAt(Date.now())
  }

  const handleRestoreFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    let text: string
    try {
      text = await file.text()
    } catch {
      showToast('Не удалось прочитать файл.', { tone: 'error' })
      return
    }

    const result = parseBackup(text)
    if (!result.ok) {
      showToast(result.error, { tone: 'error' })
      return
    }

    const restored = result.subscriptions
    const skippedNote = result.skipped > 0 ? ` Повреждённых записей пропущено: ${result.skipped}.` : ''
    setConfirm({
      title: 'Восстановить из копии?',
      message:
        subscriptions.length > 0
          ? `Текущие ${formatSubscriptionCount(subscriptions.length)} заменятся на ${restored.length} из файла.${skippedNote}`
          : `В копии ${formatSubscriptionCount(restored.length)}.${skippedNote}`,
      confirmLabel: 'Восстановить',
      destructive: subscriptions.length > 0,
      onConfirm: () => {
        dispatch({ type: 'replaceAll', subscriptions: restored })
        resetFilters()
        showToast(`Восстановлено: ${formatSubscriptionCount(restored.length)}.`)
      },
    })
  }

  const requestDelete = (subscription: Subscription) => {
    setConfirm({
      title: `Удалить «${subscription.name}»?`,
      message: 'Подписка исчезнет из списка. Это действие нельзя отменить.',
      confirmLabel: 'Удалить',
      destructive: true,
      onConfirm: () => {
        dispatch({ type: 'delete', id: subscription.id })
        setEditor(null)
        showToast('Подписка удалена.')
      },
    })
  }

  const requestReset = () => {
    setConfirm({
      title: 'Удалить все данные?',
      message: `С этого устройства удалятся ${formatSubscriptionCount(subscriptions.length)}. Перед этим можно сохранить резервную копию.`,
      confirmLabel: 'Удалить всё',
      destructive: true,
      onConfirm: () => {
        dispatch({ type: 'reset' })
        resetFilters()
        showToast('Все данные удалены.')
      },
    })
  }

  const openNotifications = () => {
    setPushMessage(null)
    setNotificationsOpen(true)
    // Разрешение могли поменять в Настройках, пока приложение было свёрнуто.
    refreshPushState()
  }

  // Запрос разрешения уходит синхронно внутри нажатия: иначе iOS его не покажет.
  const handlePushToggle = (enabled: boolean) => {
    setPushBusy(true)
    setPushMessage(null)
    const request = enabled ? enablePush(subscriptions, new Date()) : disablePush()
    request
      .then((state) => {
        setPushState(state)
        if (state === 'on') setPushMessage({ text: 'Готово: напоминания придут пушем.', tone: 'default' })
      })
      .catch((error: unknown) => setPushMessage({ text: pushErrorText(error), tone: 'error' }))
      .finally(() => setPushBusy(false))
  }

  const handleTestPush = () => {
    setPushBusy(true)
    setPushMessage(null)
    sendTestPush()
      .then(() => setPushMessage({ text: 'Тестовое уведомление отправлено.', tone: 'default' }))
      .catch((error: unknown) => setPushMessage({ text: pushErrorText(error), tone: 'error' }))
      .finally(() => setPushBusy(false))
  }

  const menuItems: MenuItem[] = [
    {
      id: 'sync',
      label: 'Синхронизация',
      icon: <CloudIcon />,
      disabled: !isSyncAvailable,
      onSelect: () => {
        setSyncMessage(null)
        setSyncOpen(true)
      },
    },
    {
      id: 'export-all',
      label: 'Все в календарь',
      icon: <CalendarPlusIcon />,
      disabled: subscriptions.length === 0,
      onSelect: handleExportAll,
    },
    {
      id: 'backup',
      label: 'Сохранить копию',
      icon: <ArrowDownDocIcon />,
      disabled: subscriptions.length === 0,
      onSelect: handleBackup,
    },
    {
      id: 'restore',
      label: 'Восстановить из копии',
      icon: <ArrowUpDocIcon />,
      onSelect: () => restoreInputRef.current?.click(),
    },
    {
      id: 'reset',
      label: 'Удалить все данные',
      icon: <TrashIcon />,
      destructive: true,
      disabled: subscriptions.length === 0,
      onSelect: requestReset,
    },
  ]

  const openCreate = () => setEditor({ mode: 'create' })

  return (
    <>
      <NavBar title="Подписки" menuItems={menuItems} onBellClick={openNotifications} />

      <main className={styles.main}>
        {subscriptions.length === 0 ? (
          <EmptyState variant="empty" onAction={openCreate} />
        ) : tab === 'stats' ? (
          <StatsView subscriptions={subscriptions} today={today} rates={rates} />
        ) : tab === 'calendar' ? (
          <CalendarView
            subscriptions={subscriptions}
            today={today}
            rates={rates}
            hidden={hideAmounts}
            onOpen={(subscription) => setEditor({ mode: 'edit', id: subscription.id })}
            onMarkPaid={handleMarkPaid}
          />
        ) : (
          <>
            {needsBackup && (
              <BackupReminder
                onBackup={handleBackup}
                onSnooze={() => setLastBackupAt(Date.now() - BACKUP_REMINDER_MS + BACKUP_SNOOZE_MS)}
              />
            )}
            <SummaryBar
              subscriptions={subscriptions}
              today={today}
              rates={rates}
              hidden={hideAmounts}
              onToggleHidden={() => setHideAmounts((value) => !value)}
            />
            <NextPayment
              subscriptions={subscriptions}
              today={today}
              hidden={hideAmounts}
              onOpen={(subscription) => setEditor({ mode: 'edit', id: subscription.id })}
            />
            {subscriptions.length >= 6 && <SearchField value={searchQuery} onChange={setSearchQuery} />}
            {visibleSubscriptions.length === 0 ? (
              <EmptyState variant="filtered" onAction={resetFilters} />
            ) : (
              <SubscriptionList
                subscriptions={visibleSubscriptions}
                today={today}
                onEdit={(subscription) => setEditor({ mode: 'edit', id: subscription.id })}
                onExport={handleExport}
                onMarkPaid={handleMarkPaid}
                onDelete={requestDelete}
                onFilters={() => setFiltersOpen(true)}
                filtersActive={filtersActive}
              />
            )}
          </>
        )}
      </main>

      <BottomBar tab={subscriptions.length > 0 ? tab : null} onTabChange={setTab} onAdd={openCreate} />

      <SubscriptionForm
        open={formOpen}
        subscription={editing}
        categories={categories}
        today={today}
        onCancel={() => setEditor(null)}
        onSave={handleSave}
        onDelete={requestDelete}
        onExport={handleExport}
        onMarkPaid={handleMarkPaid}
      />
      <NotificationsSheet
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        pushState={pushState}
        busy={pushBusy}
        message={pushMessage}
        onPushToggle={handlePushToggle}
        onTestPush={handleTestPush}
        onExportAll={handleExportAll}
        exportDisabled={subscriptions.length === 0}
      />
      <FiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        subscriptions={subscriptions}
        rates={rates}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        categories={categories}
        category={activeCategory}
        onCategoryChange={setCategoryFilter}
        onReset={resetFilters}
      />
      <SyncSheet
        open={syncOpen}
        onClose={() => setSyncOpen(false)}
        state={sync.state}
        busy={syncBusy}
        message={syncMessage}
        onConnect={handleSyncConnect}
        onDisconnect={handleSyncDisconnect}
      />
      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
      <Toast toast={toast} onDismiss={dismissToast} />

      <input
        ref={restoreInputRef}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          void handleRestoreFile(event)
        }}
      />
    </>
  )
}
