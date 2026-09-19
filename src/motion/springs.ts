/**
 * Пружины по таблице Quick Reference из skill apple-design.
 * bounce/duration — параметры motion, приближающие damping/response Apple:
 * SPRING_DEFAULT ~ damping 1.0 (без жеста — меню, тост, alert),
 * SPRING_DRAWER ~ damping 0.8 (drawer/sheet, лёгкий overshoot).
 */
export const SPRING_DEFAULT = { type: 'spring', bounce: 0, duration: 0.35 } as const
export const SPRING_DRAWER = { type: 'spring', bounce: 0.2, duration: 0.3 } as const

/** Куда докатится жест по инерции: экспоненциальное затухание, не v²/2a. */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}
