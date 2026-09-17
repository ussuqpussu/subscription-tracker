import type { Lamp } from '../types'
import styles from './StatusLamp.module.css'

interface StatusLampProps {
  lamp: Lamp
  size?: 'regular' | 'small'
}

/** Светящаяся лампочка срока. Декоративная: смысл всегда дублируется текстом рядом. */
export function StatusLamp({ lamp, size = 'regular' }: StatusLampProps) {
  return <span className={styles.lamp} data-lamp={lamp} data-size={size} aria-hidden="true" />
}
