/** UUID для новой подписки. randomUUID есть только в защищённом контексте (https, localhost). */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {
      // Падаем в запасной вариант ниже.
    }
  }
  const random = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0')
  return `${Date.now().toString(36)}-${random()}-${random()}`
}
