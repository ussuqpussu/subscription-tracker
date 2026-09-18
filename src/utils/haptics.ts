/**
 * Короткий виброотклик на касание.
 *
 * Android и десктопный Chrome умеют navigator.vibrate. В Safari на iPhone его нет,
 * зато система сама щёлкает по переключателю <input type="checkbox" switch> (iOS 17.4+):
 * держим такой переключатель спрятанным за экраном и программно нажимаем на его <label>.
 * Отклик — украшение, поэтому всё обёрнуто в try/catch и молча пропускается там,
 * где не поддерживается.
 */

let switchLabel: HTMLLabelElement | null = null

/** Спрятанный переключатель создаётся один раз при первом касании. */
function getSwitchLabel(): HTMLLabelElement {
  if (switchLabel?.isConnected) return switchLabel

  const label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  label.style.cssText = 'position:fixed;top:-100px;left:-100px;width:1px;height:1px;opacity:0;pointer-events:none'

  const input = document.createElement('input')
  input.type = 'checkbox'
  // Атрибут без значения: React такой переключатель не умеет, поэтому элемент ручной.
  input.setAttribute('switch', '')
  input.tabIndex = -1
  label.append(input)

  document.body.append(label)
  switchLabel = label
  return label
}

export function tapHaptic(): void {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(8)
      return
    }
    getSwitchLabel().click()
  } catch {
    // Виброотклика на этом устройстве нет — это не ошибка.
  }
}
