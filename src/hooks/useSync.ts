import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { SYNC_KEY } from '../constants'
import type { Subscription } from '../types'
import { decryptVault, encryptVault, getVaultId, hashSubscriptions } from '../utils/sync'
import { readVault, writeVault } from '../utils/syncApi'
import { useLocalStorage } from './useLocalStorage'

/** Пауза после правки: серия изменений уходит одним запросом. */
const PUSH_DELAY_MS = 1500

export interface SyncState {
  /** Секретный код; из него на устройстве выводятся ключ и адрес хранилища. */
  code: string
  vaultId: string
  /** Версия, полученная от сервера при последней удачной записи или чтении. */
  version: number
  /** Отпечаток списка на момент последней синхронизации: по нему видно несохранённые правки. */
  hash?: string
}

const parseSyncState = (raw: unknown): SyncState | null => {
  if (typeof raw !== 'object' || raw === null) return null
  const { code, vaultId, version } = raw as Record<string, unknown>
  if (typeof code !== 'string' || typeof vaultId !== 'string') return null
  const { hash } = raw as Record<string, unknown>
  return {
    code,
    vaultId,
    version: typeof version === 'number' ? version : 0,
    ...(typeof hash === 'string' ? { hash } : {}),
  }
}

export interface SyncApi {
  state: SyncState | null
  setState: Dispatch<SetStateAction<SyncState | null>>
  /** Забирает данные с сервера прямо сейчас. Возвращает true, если список заменился. */
  pull: (state: SyncState) => Promise<boolean>
  /** Отправляет текущие подписки. Если на сервере свежее — берёт их себе. */
  push: (state: SyncState, subscriptions: readonly Subscription[]) => Promise<void>
  /** Адрес хранилища по коду: нужен при подключении второго устройства. */
  resolve: (code: string) => Promise<SyncState>
}

/**
 * Синхронизация подписок между устройствами: выгрузка после правок и загрузка при открытии.
 * При расхождении версий побеждает то, что уже лежит на сервере.
 */
export function useSync(
  subscriptions: readonly Subscription[],
  setSubscriptions: Dispatch<SetStateAction<Subscription[]>>,
  today: Date,
  onError: (message: string) => void,
): SyncApi {
  const [state, setState] = useLocalStorage<SyncState | null>(SYNC_KEY, null, parseSyncState)
  /** Последний выгруженный список: повторные выгрузки того же содержимого пропускаем. */
  const lastSyncedRef = useRef<string | null>(null)

  const pull = useCallback(
    async (current: SyncState) => {
      const snapshot = await readVault(current.vaultId)
      if (!snapshot) return false
      const restored = await decryptVault(snapshot.blob, current.code)
      const hash = hashSubscriptions(restored)
      lastSyncedRef.current = hash
      setSubscriptions(restored)
      setState({ ...current, version: snapshot.version, hash })
      return true
    },
    [setState, setSubscriptions],
  )

  const push = useCallback(
    async (current: SyncState, items: readonly Subscription[]) => {
      const blob = await encryptVault(items, current.code)
      const result = await writeVault(current.vaultId, blob, current.version)
      if (result.ok) {
        setState({ ...current, version: result.version, hash: hashSubscriptions(items) })
        return
      }
      // Другое устройство записало раньше: берём его данные, чтобы списки сошлись.
      const restored = await decryptVault(result.snapshot.blob, current.code)
      const hash = hashSubscriptions(restored)
      lastSyncedRef.current = hash
      setSubscriptions(restored)
      setState({ ...current, version: result.snapshot.version, hash })
    },
    [setState, setSubscriptions],
  )

  const resolve = useCallback(async (code: string): Promise<SyncState> => {
    return { code, vaultId: await getVaultId(code), version: 0 }
  }, [])

  // Версия меняется после каждой выгрузки, поэтому состояние держим в ref:
  // иначе выгрузка запускала бы сама себя.
  const stateRef = useRef(state)
  const subscriptionsRef = useRef(subscriptions)
  useEffect(() => {
    stateRef.current = state
    subscriptionsRef.current = subscriptions
  }, [state, subscriptions])

  const vaultId = state?.vaultId
  const report = (error: unknown) => onError(error instanceof Error ? error.message : 'Не удалось синхронизировать.')

  // При открытии приложения и после полуночи забираем чужие правки.
  // Если на устройстве есть невыгруженные изменения, сначала отправляем их: чужая загрузка их бы стёрла.
  useEffect(() => {
    const current = stateRef.current
    if (!current) return
    const items = subscriptionsRef.current
    const unsaved = current.hash !== undefined && current.hash !== hashSubscriptions(items)
    const task = unsaved ? push(current, items) : pull(current)
    task.catch(report)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultId, today, pull, push])

  // После правок выгружаем список; одинаковое содержимое повторно не отправляем.
  useEffect(() => {
    const current = stateRef.current
    if (!current) return
    const snapshot = hashSubscriptions(subscriptions)
    if (snapshot === lastSyncedRef.current) return
    const timer = window.setTimeout(() => {
      lastSyncedRef.current = snapshot
      push(current, subscriptions).catch(report)
    }, PUSH_DELAY_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptions, vaultId, push])

  return { state, setState, pull, push, resolve }
}
