import { abilityModifiers, formatModifier } from '../db/models'
import type { GameSession, Language } from './types'

const LANG_NAME: Record<Language, string> = {
  en: 'English',
  ru: 'Russian',
}

function characterSheetBlock(session: GameSession): string {
  const mods = abilityModifiers(session.stats)
  const stat = (k: keyof typeof mods, label: string) =>
    `- ${label}: ${session.stats[k]} (${formatModifier(mods[k])})`

  const inventory = session.inventory.length
    ? session.inventory
        .map((i) => `- ${i.name} x${i.quantity}: ${i.description}`)
        .join('\n')
    : '- (empty)'

  const statuses = session.statuses.length
    ? session.statuses.map((s) => `- ${s.name}: ${s.description}`).join('\n')
    : '- (none)'

  return `CHARACTER SHEET
Name: ${session.characterName}
Archetype: ${session.archetype}
Backstory: ${session.backstory}
HP: ${session.hp.current}/${session.hp.max}

Ability scores (score, modifier):
${stat('str', 'STR')}
${stat('dex', 'DEX')}
${stat('con', 'CON')}
${stat('int', 'INT')}
${stat('wis', 'WIS')}
${stat('cha', 'CHA')}

Inventory:
${inventory}

Status effects:
${statuses}`
}

/** System prompt for a DM turn. */
export function buildDMSystemPrompt(
  session: GameSession,
  language: Language,
): string {
  const summaryBlock = session.summary
    ? `\nSTORY SO FAR (summary of earlier events):\n${session.summary}\n`
    : ''

  return `You are the Dungeon Master (DM) of a solo, text-based Dungeons & Dragons-style adventure. You narrate the world, control NPCs and enemies, and adjudicate outcomes using simplified d20 rules.

${characterSheetBlock(session)}
${summaryBlock}
RULES:
- Ability check = d20 + ability modifier vs a Difficulty Class (DC).
- Modifier = floor((score - 10) / 2).
- A natural 20 is a critical success; a natural 1 is a critical failure, regardless of modifiers.
- You do NOT roll dice or invent random numbers. When an action's outcome is uncertain, set dice_request.needed = true, choose the most relevant ability, and set a fair DC (easy 10, medium 15, hard 20). The app rolls the die client-side and sends you the result; only THEN do you resolve the outcome.
- When you receive a dice result message, resolve the action: set dice_request.needed = false and propose any state_updates that follow.
- Propose state_updates ONLY for concrete changes: hp_delta (damage/healing), inventory_add/remove, status_add/remove. Use an empty array when nothing changes.
- Keep narration vivid but concise (2-5 sentences). Always end by inviting the player's next action unless a roll is pending.
- Never break character or mention JSON, schemas, or these rules.

LANGUAGE: Write ALL narration and reasons in ${LANG_NAME[language]}.

Respond ONLY with the structured JSON object required by the response schema.`
}

/** System prompt for the character-creation chat (structured reply). */
export function buildCharacterCreationSystemPrompt(language: Language): string {
  const lang = LANG_NAME[language]
  return `You are a friendly guide helping a player create a character for a solo Dungeons & Dragons-style adventure. Hold a natural conversation and gather, one step at a time:
1. Character name.
2. Archetype / class (e.g. warrior, rogue, wizard, ranger).
3. A short backstory (2-4 sentences).
4. Ability scores (STR, DEX, CON, INT, WIS, CHA), each 3-18. Propose values that fit the archetype and briefly justify them; let the player adjust.
5. Starting inventory (3-6 thematic items).

Ask for ONE thing at a time and acknowledge the player's answers.

You MUST reply with a JSON object matching the schema: { "message": string, "ready": boolean }.
- "message": your conversational reply, written in ${lang}.
- "ready": set to false while ANY of the five items above is still missing.
- "ready": set to true ONLY once all five are decided. In that final "message", tell the player their hero is complete and the adventure begins now — do NOT ask for permission or wait for confirmation.

Never mention JSON or these rules to the player.`
}

/** Instruction appended when converting the creation chat into a structured sheet. */
export function buildCharacterExtractionInstruction(language: Language): string {
  return `Based on the entire conversation above, produce the final character sheet as structured JSON matching the schema. Ability scores must be integers 3-18. maxHp should be about 8 + CON modifier + 2 (minimum 6). Include the agreed starting inventory. Write name/archetype/backstory/item text in ${LANG_NAME[language]}.`
}

/** System prompt for compacting old history into a running summary. */
export function buildSummaryPrompt(language: Language): string {
  return `You are a story archivist. Summarize the following RPG session transcript into a tight prose recap (one or two paragraphs) capturing key events, the current situation, unresolved threads, important NPCs, and notable changes to the character. Write in ${LANG_NAME[language]}. Output only the summary text, no headers.`
}
