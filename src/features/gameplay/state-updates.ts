import type {
  GameSession,
  StateUpdate,
  HpDeltaPayload,
  InventoryAddPayload,
  InventoryRemovePayload,
  StatusAddPayload,
  StatusRemovePayload,
} from '../../api/types'

/**
 * Applies proposed state_updates to a session IN PLACE. HP is clamped to
 * [0, max]. Inventory quantities merge/decrement; items hitting 0 are removed.
 * Returns the mutated session for chaining.
 */
export function applyStateUpdates(
  session: GameSession,
  updates: StateUpdate[],
): GameSession {
  for (const update of updates) {
    switch (update.type) {
      case 'hp_delta': {
        const { amount } = update.payload as HpDeltaPayload
        const next = session.hp.current + (Number(amount) || 0)
        session.hp.current = Math.max(0, Math.min(session.hp.max, next))
        break
      }
      case 'inventory_add': {
        const p = update.payload as InventoryAddPayload
        const qty = Number(p.quantity) || 1
        const existing = session.inventory.find((i) => i.name === p.name)
        if (existing) {
          existing.quantity += qty
        } else {
          session.inventory.push({
            name: p.name,
            description: p.description ?? '',
            quantity: qty,
          })
        }
        break
      }
      case 'inventory_remove': {
        const p = update.payload as InventoryRemovePayload
        const qty = Number(p.quantity) || 1
        const existing = session.inventory.find((i) => i.name === p.name)
        if (existing) {
          existing.quantity -= qty
          if (existing.quantity <= 0) {
            session.inventory = session.inventory.filter(
              (i) => i.name !== p.name,
            )
          }
        }
        break
      }
      case 'status_add': {
        const p = update.payload as StatusAddPayload
        if (!session.statuses.some((s) => s.name === p.name)) {
          session.statuses.push({
            name: p.name,
            description: p.description ?? '',
          })
        }
        break
      }
      case 'status_remove': {
        const p = update.payload as StatusRemovePayload
        session.statuses = session.statuses.filter((s) => s.name !== p.name)
        break
      }
    }
  }
  return session
}

/** Human-readable one-line description of a proposed update, for the diff UI. */
export function describeStateUpdate(update: StateUpdate): string {
  switch (update.type) {
    case 'hp_delta': {
      const amt = Number((update.payload as HpDeltaPayload).amount) || 0
      return amt >= 0 ? `HP +${amt}` : `HP ${amt}`
    }
    case 'inventory_add': {
      const p = update.payload as InventoryAddPayload
      return `+ ${p.name} x${Number(p.quantity) || 1}`
    }
    case 'inventory_remove': {
      const p = update.payload as InventoryRemovePayload
      return `- ${p.name} x${Number(p.quantity) || 1}`
    }
    case 'status_add':
      return `Status: ${(update.payload as StatusAddPayload).name}`
    case 'status_remove':
      return `Remove status: ${(update.payload as StatusRemovePayload).name}`
    default:
      return update.type
  }
}
