import type {
  GameSession,
  StateUpdate,
  HpDeltaPayload,
  InventoryAddPayload,
  InventoryRemovePayload,
  StatusAddPayload,
  StatusRemovePayload,
  EnemyAddPayload,
  EnemyHpDeltaPayload,
  EnemyRemovePayload,
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
  // Older saved sessions may predate enemy tracking.
  if (!session.enemies) session.enemies = []
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
      case 'enemy_add': {
        const p = update.payload as EnemyAddPayload
        const max = Math.max(1, Math.round(Number(p.maxHp)) || 10)
        const existing = session.enemies.find((e) => e.name === p.name)
        if (!existing) {
          session.enemies.push({
            name: p.name,
            hp: { current: max, max },
            description: p.description ?? '',
          })
        }
        break
      }
      case 'enemy_hp_delta': {
        const p = update.payload as EnemyHpDeltaPayload
        const enemy = session.enemies.find((e) => e.name === p.name)
        if (enemy) {
          enemy.hp.current = Math.max(
            0,
            Math.min(enemy.hp.max, enemy.hp.current + (Number(p.amount) || 0)),
          )
          // A defeated enemy leaves the field.
          if (enemy.hp.current <= 0) {
            session.enemies = session.enemies.filter((e) => e.name !== p.name)
          }
        }
        break
      }
      case 'enemy_remove': {
        const p = update.payload as EnemyRemovePayload
        session.enemies = session.enemies.filter((e) => e.name !== p.name)
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
    case 'enemy_add': {
      const p = update.payload as EnemyAddPayload
      return `⚔ ${p.name} (${Math.max(1, Math.round(Number(p.maxHp)) || 10)} HP)`
    }
    case 'enemy_hp_delta': {
      const p = update.payload as EnemyHpDeltaPayload
      const amt = Number(p.amount) || 0
      return `${p.name}: ${amt >= 0 ? `+${amt}` : amt} HP`
    }
    case 'enemy_remove':
      return `☠ ${(update.payload as EnemyRemovePayload).name}`
    default:
      return update.type
  }
}
