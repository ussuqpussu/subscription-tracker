/** Запросы к хранилищу синхронизации. На сервер уходит только шифротекст. */
import { API_URL } from '../config'
import { SyncError } from './sync'

export const isSyncAvailable = API_URL !== ''

export interface VaultSnapshot {
  blob: string
  version: number
  updatedAt: number
}

async function request(method: 'GET' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new SyncError('Сервер синхронизации недоступен. Проверьте интернет.')
  }
}

/** Снимок с сервера или null, если для этого кода ещё ничего не сохранено. */
export async function readVault(id: string): Promise<VaultSnapshot | null> {
  const response = await request('GET', `/api/vault?id=${id}`)
  if (response.status === 404) return null
  if (!response.ok) throw new SyncError(`Сервер синхронизации ответил ошибкой ${response.status}.`)
  return (await response.json()) as VaultSnapshot
}

export type WriteResult =
  | { ok: true; version: number; updatedAt: number }
  /** Кто-то записал раньше: в ответе свежий снимок. */
  | { ok: false; snapshot: VaultSnapshot }

export async function writeVault(id: string, blob: string, version: number): Promise<WriteResult> {
  const response = await request('PUT', '/api/vault', { id, blob, version })
  if (response.status === 409) return { ok: false, snapshot: (await response.json()) as VaultSnapshot }
  if (!response.ok) throw new SyncError(`Сервер синхронизации ответил ошибкой ${response.status}.`)
  const { version: next, updatedAt } = (await response.json()) as { version: number; updatedAt: number }
  return { ok: true, version: next, updatedAt }
}

export async function deleteVault(id: string): Promise<void> {
  await request('DELETE', '/api/vault', { id }).catch(() => undefined)
}
