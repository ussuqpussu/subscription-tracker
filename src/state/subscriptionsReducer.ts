import type { Subscription } from '../types'
import { markPaid, mergeEdit, withInitialPaidThrough } from '../utils/subscriptionUtils'

export type SubscriptionsAction =
  | { type: 'add'; subscription: Subscription; today: Date }
  | { type: 'update'; subscription: Subscription; today: Date }
  | { type: 'delete'; id: string }
  | { type: 'markPaid'; id: string }
  | { type: 'setPaidThrough'; id: string; paidThrough: string | undefined }
  | { type: 'replaceAll'; subscriptions: Subscription[] }
  | { type: 'reset' }

function updateById(
  state: Subscription[],
  id: string,
  update: (item: Subscription) => Subscription,
): Subscription[] {
  let changed = false
  const next = state.map((item) => {
    if (item.id !== id) return item
    changed = true
    return update(item)
  })
  return changed ? next : state
}

export function subscriptionsReducer(
  state: Subscription[],
  action: SubscriptionsAction,
): Subscription[] {
  switch (action.type) {
    case 'add':
      return [...state, withInitialPaidThrough(action.subscription, action.today)]
    case 'update':
      return updateById(state, action.subscription.id, (previous) =>
        mergeEdit(previous, action.subscription, action.today),
      )
    case 'delete':
      return state.filter((item) => item.id !== action.id)
    case 'markPaid':
      return updateById(state, action.id, markPaid)
    case 'setPaidThrough':
      return updateById(state, action.id, (item) => {
        const next: Subscription = { ...item }
        if (action.paidThrough) next.paidThrough = action.paidThrough
        else delete next.paidThrough
        return next
      })
    case 'replaceAll':
      return action.subscriptions
    case 'reset':
      return []
  }
}
