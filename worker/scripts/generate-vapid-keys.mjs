// Генерирует пару VAPID-ключей P-256 в base64url: публичный — 65 байт без сжатия, приватный — 32 байта.
// Публичный ключ нужен приложению (VITE_VAPID_PUBLIC_KEY) и серверу, приватный — только серверу.
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
])
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey))
const { d } = await crypto.subtle.exportKey('jwk', privateKey)
console.log(JSON.stringify({ publicKey: Buffer.from(raw).toString('base64url'), privateKey: d }, null, 2))
