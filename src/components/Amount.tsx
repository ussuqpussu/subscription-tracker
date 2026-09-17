import { CURRENCY_SYMBOLS } from '../constants'
import type { Currency } from '../types'
import { formatMoney } from '../utils/format'

interface AmountProps {
  amount: number
  currency: Currency
  /** Режим «глаз закрыт»: вместо цифр точки, скринридер слышит «сумма скрыта». */
  hidden: boolean
}

export function Amount({ amount, currency, hidden }: AmountProps) {
  if (!hidden) return <>{formatMoney(amount, currency)}</>
  return (
    <>
      <span aria-hidden="true">•••• {CURRENCY_SYMBOLS[currency]}</span>
      <span className="visually-hidden">сумма скрыта</span>
    </>
  )
}
