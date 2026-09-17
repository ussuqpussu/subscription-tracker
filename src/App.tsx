import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import styles from './App.module.css'
import { BottomBar } from './components/BottomBar'
import { ConfirmSheet, type ConfirmRequest } from './components/ConfirmSheet'
import { EmptyState } from './components/EmptyState'
import { Filters } from './components/Filters'
import { ArrowDownDocIcon, ArrowUpDocIcon, CalendarPlusIcon, TrashIcon } from './components/icons'
import type { MenuItem } from './components/MoreMenu'
import { NavBar } from './components/NavBar'
import { NextPayment } from './components/NextPayment'
import { NotificationsSheet, type PushMessage } from './components/NotificationsSheet'
import { SubscriptionForm, type SubscriptionValue } from './components/SubscriptionForm'
import { SubscriptionList } from './components/SubscriptionList'
import { SummaryBar } from './components/SummaryBar'
import { Toast, type ToastMessage } from './components/Toast'
import { HIDE_AMOUNTS_KEY, STORAGE_KEY } from './constants'
import { useLocalStorage } from './hooks/useLocalStorage'
import { usePushSync } from './hooks/usePushSync'
import { useRates } from './hooks/useRates'
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
import {
  collectCategories,
  filterSubscriptions,
  getLamp,
  isActive,
  markPaid,
  sortSubscriptions,
  type StatusFilter,
} from './utils/subscriptionUtils'

type EditorState = { mode: 'create' } | { mode: 'edit'; id: string } | null

const parseStoredSubscriptions = (raw: unknown) => normalizeSubscriptions(raw).items
const parseStoredFlag = (raw: unknown) => raw === true

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
  const [editor, setEditor] = useState<EditorState>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [pushState, setPushState] = useState<PushState>(isPushConfigured ? 'off' : 'unconfigured')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMessage, setPushMessage] = useState<PushMessage | null>(null)
  const restoreInputRef = useRef<HTMLInputElement>(null)

  const categories = useMemo(() => collectCategories(subscriptions), [subscriptions])
  // Если категорию удалили или переименовали, фильтр по ней молча сбрасывается.
  const activeCategory = categoryFilter !== null && categories.includes(categoryFilter) ? categoryFilter : null
  const visibleSubscriptions = useMemo(
    () =>
      sortSubscriptions(
        filterSubscriptions(subscriptions, { status: statusFilter, category: activeCategory }),
        today,
      ),
    [subscriptions, statusFilter, activeCategory, today],
  )

  // Курс нужен, только если есть активные подписки не в рублях.
  const rates = useRates(
    subscriptions.some((item) => isActive(item) && item.currency !== 'RUB'),
    today,
  )

  const attention = subscriptions.some((item) => {
    const lamp = getLamp(item, today)
    return lamp === 'yellow' || lamp === 'red'
  })

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
      <NavBar title="Подписки" menuItems={menuItems} attention={attention} onBellClick={openNotifications} />

      <main className={styles.main}>
        {subscriptions.length === 0 ? (
          <EmptyState variant="empty" onAction={openCreate} />
        ) : (
          <>
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
            <Filters
              categories={categories}
              category={activeCategory}
              onCategoryChange={setCategoryFilter}
              onAdd={openCreate}
            />
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
              />
            )}
          </>
        )}
      </main>

      <BottomBar
        status={subscriptions.length > 0 ? statusFilter : null}
        onStatusChange={setStatusFilter}
        onAdd={openCreate}
      />

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
