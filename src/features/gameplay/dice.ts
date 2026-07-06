import type { AbilityOrNone, DiceResult, Stats } from '../../api/types'
import { calculateAbilityModifier } from '../../db/models'

/** True-random d20 via the Web Crypto API (rejection sampling, no modulo bias). */
export function rollD20(): number {
  const buf = new Uint8Array(1)
  // 250 is the largest multiple of 20 below 256; reject above it.
  let byte: number
  do {
    crypto.getRandomValues(buf)
    byte = buf[0]
  } while (byte >= 250)
  return (byte % 20) + 1
}

/** Resolve a d20 check for an ability against a DC. Nat 20 always succeeds, nat 1 always fails. */
export function resolveRoll(
  ability: AbilityOrNone,
  stats: Stats,
  dc: number,
  roll: number = rollD20(),
): DiceResult {
  const modifier =
    ability === 'none' ? 0 : calculateAbilityModifier(stats[ability])
  const total = roll + modifier
  const isNaturalTwenty = roll === 20
  const isNaturalOne = roll === 1
  let success = total >= dc
  if (isNaturalTwenty) success = true
  if (isNaturalOne) success = false
  return {
    ability,
    roll,
    modifier,
    total,
    dc,
    success,
    isNaturalTwenty,
    isNaturalOne,
  }
}
