/**
 * Синхронизация между устройствами. Подписки шифруются на устройстве ключом,
 * выведенным из секретного кода; сервер хранит только шифротекст и номер версии.
 * Код нигде не передаётся: на сервер уходит отдельное значение, из которого ключ не восстановить.
 */
import type { Subscription } from '../types'
import { normalizeSubscriptions } from './subscriptionSchema'

/** Алфавит кода без похожих символов (0/O, 1/I). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** Длина кода: 24 символа по 5 бит — 120 бит случайности. */
export const CODE_LENGTH = 24
const GROUP_SIZE = 6

export class SyncError extends Error {}

/** Случайный код синхронизации в виде «ABCD-EFGH-…». */
export function createSyncCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  const code = [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
  return formatSyncCode(code)
}

/** Приводит введённый код к каноническому виду: только буквы алфавита, группами по 6. */
export function normalizeSyncCode(value: string): string | null {
  const letters = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (letters.length !== CODE_LENGTH) return null
  if (![...letters].every((letter) => CODE_ALPHABET.includes(letter))) return null
  return formatSyncCode(letters)
}

function formatSyncCode(letters: string): string {
  const groups = letters.match(new RegExp(`.{1,${GROUP_SIZE}}`, 'g')) ?? []
  return groups.join('-')
}

/** Короткий отпечаток списка: по нему видно, менялись ли подписки после синхронизации. */
export function hashSubscriptions(subscriptions: readonly Subscription[]): string {
  const text = JSON.stringify(subscriptions)
  let hash = 5381
  for (let i = 0; i < text.length; i += 1) hash = (hash * 33) ^ text.charCodeAt(i)
  return (hash >>> 0).toString(36) + ':' + text.length.toString(36)
}

/** Байты строки из символов ASCII. Отдельный буфер нужен типам WebCrypto. */
function asciiBytes(value: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(value.length))
  for (let i = 0; i < value.length; i += 1) bytes[i] = value.charCodeAt(i)
  return bytes
}

/** Код без разделителей — из него выводятся ключ и адрес хранилища. */
function codeBytes(code: string): Uint8Array<ArrayBuffer> {
  return asciiBytes(code.replace(/-/g, ''))
}

async function hkdf(code: string, info: string, bits: number): Promise<ArrayBuffer> {
  const material = await crypto.subtle.importKey('raw', codeBytes(code), 'HKDF', false, ['deriveBits'])
  return crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: asciiBytes('subscription-tracker'), info: asciiBytes(info) },
    material,
    bits,
  )
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Адрес хранилища на сервере: 64 шестнадцатеричных символа. По нему ключ не восстановить. */
export function getVaultId(code: string): Promise<string> {
  return hkdf(code, 'vault-id', 256).then(toHex)
}

async function getKey(code: string): Promise<CryptoKey> {
  const bits = await hkdf(code, 'vault-key', 256)
  return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Шифротекст вместе со случайным вектором: «iv.ciphertext» в base64. */
export async function encryptVault(subscriptions: readonly Subscription[], code: string): Promise<string> {
  const key = await getKey(code)
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)))
  const data = new TextEncoder().encode(JSON.stringify(subscriptions))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  return `${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`
}

/** Расшифровка с проверкой данных. Неверный код или испорченный blob — SyncError. */
export async function decryptVault(blob: string, code: string): Promise<Subscription[]> {
  const [ivPart, dataPart] = blob.split('.')
  if (!ivPart || !dataPart) throw new SyncError('Данные на сервере повреждены.')
  const key = await getKey(code)
  let plain: ArrayBuffer
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(ivPart) }, key, fromBase64(dataPart))
  } catch {
    throw new SyncError('Код не подходит к этим данным.')
  }
  try {
    return normalizeSubscriptions(JSON.parse(new TextDecoder().decode(plain))).items
  } catch {
    throw new SyncError('Данные на сервере повреждены.')
  }
}
