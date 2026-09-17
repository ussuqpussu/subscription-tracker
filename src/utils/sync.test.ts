import { describe, expect, it } from 'vitest'
import type { Subscription } from '../types'
import { CODE_LENGTH, createSyncCode, decryptVault, encryptVault, getVaultId, normalizeSyncCode, SyncError } from './sync'

const subscriptions: Subscription[] = [
  {
    id: '1',
    name: 'Кинопоиск',
    price: 299,
    currency: 'RUB',
    startDate: '2026-09-20',
    billingPeriod: 'monthly',
    category: 'Кино',
    status: 'active',
    reminders: [1, 3],
  },
]

describe('код синхронизации', () => {
  it('генерируется группами и проходит проверку', () => {
    const code = createSyncCode()
    expect(code).toMatch(/^[A-Z2-9]{6}-[A-Z2-9]{6}-[A-Z2-9]{6}-[A-Z2-9]{6}$/)
    expect(normalizeSyncCode(code.toLowerCase())).toBe(code)
    expect(code.replace(/-/g, '')).toHaveLength(CODE_LENGTH)
  })

  it('отклоняет неполные и посторонние коды', () => {
    expect(normalizeSyncCode('ABC')).toBeNull()
    expect(normalizeSyncCode('А'.repeat(24))).toBeNull()
    expect(normalizeSyncCode('')).toBeNull()
  })
})

describe('шифрованное хранилище', () => {
  it('расшифровывается тем же кодом', async () => {
    const code = createSyncCode()
    const blob = await encryptVault(subscriptions, code)
    expect(blob).not.toContain('Кинопоиск')
    await expect(decryptVault(blob, code)).resolves.toEqual(subscriptions)
  })

  it('чужой код не подходит', async () => {
    const blob = await encryptVault(subscriptions, createSyncCode())
    await expect(decryptVault(blob, createSyncCode())).rejects.toBeInstanceOf(SyncError)
    await expect(decryptVault('мусор', createSyncCode())).rejects.toBeInstanceOf(SyncError)
  })

  it('адрес хранилища не совпадает с ключом и стабилен', async () => {
    const code = createSyncCode()
    const id = await getVaultId(code)
    expect(id).toMatch(/^[0-9a-f]{64}$/)
    expect(await getVaultId(code)).toBe(id)
    expect(await getVaultId(createSyncCode())).not.toBe(id)
  })
})
