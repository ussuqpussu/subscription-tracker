/** Проекция точки покоя по скорости жеста (экспоненциальное затухание, не v²/2a). */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

/** Резиновое сопротивление у границы: чем дальше за край, тем меньше движение следует за пальцем. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/** damping/response для drawer/swipe-жестов, несущих momentum (таблица skill apple-design: 0.8 / 0.3). */
export const DRAWER_SPRING = { damping: 0.8, response: 0.3 } as const

/** damping/response для простого перемещения без momentum — без перелёта (таблица skill: 1.0 / 0.4). */
export const MOVE_SPRING = { damping: 1, response: 0.4 } as const

interface SpringOptions {
  from: number
  to: number
  /** Скорость на старте, px/с. */
  velocity?: number
  /** 1 = без перелёта (критическое демпфирование), ~0.8 = лёгкий bounce для momentum-жестов. */
  damping?: number
  /** Время до затухания, секунды (не длительность — точного конца у пружины нет). */
  response?: number
  onUpdate: (value: number) => void
  onDone?: () => void
}

/**
 * RAF-пружина (damped harmonic oscillator). Начинает с текущего visual-значения и скорости,
 * поэтому её можно прервать в любой момент новым drag'ом — просто перестать звать onUpdate (cancel())
 * и стартовать следующую пружину/жест с последнего отданного значения.
 */
export function animateSpring({ from, to, velocity = 0, damping = 1, response = 0.35, onUpdate, onDone }: SpringOptions) {
  if (reducedMotion()) {
    onUpdate(to)
    onDone?.()
    return () => {}
  }

  const w0 = (2 * Math.PI) / response
  const a = from - to
  const v0 = velocity
  let stopped = false

  const positionAt = (t: number) => {
    if (damping >= 1) {
      // Критическое демпфирование.
      return to + Math.exp(-w0 * t) * (a + (v0 + w0 * a) * t)
    }
    const wd = w0 * Math.sqrt(1 - damping * damping)
    const b = (v0 + damping * w0 * a) / wd
    return to + Math.exp(-damping * w0 * t) * (a * Math.cos(wd * t) + b * Math.sin(wd * t))
  }

  const start = performance.now()
  let frame: number

  const tick = (now: number) => {
    if (stopped) return
    const t = (now - start) / 1000
    const value = positionAt(t)
    onUpdate(value)
    // Считаем осевшей, когда почти в цели и сама не движется (t=0.05с назад тоже почти там же).
    const settled = Math.abs(value - to) < 0.5 && Math.abs(positionAt(t + 0.05) - value) < 0.1
    if (settled) {
      onUpdate(to)
      onDone?.()
      return
    }
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)

  return () => {
    stopped = true
    cancelAnimationFrame(frame)
  }
}
