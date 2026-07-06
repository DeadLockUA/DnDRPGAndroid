import { Type } from '@google/genai'

// Gemini responseSchema for a single DM turn.
export const DM_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    narration: {
      type: Type.STRING,
      description: 'The DM narration of what happens, in the player language.',
    },
    dice_request: {
      type: Type.OBJECT,
      properties: {
        needed: {
          type: Type.BOOLEAN,
          description: 'True if the player must roll before the outcome resolves.',
        },
        ability: {
          type: Type.STRING,
          enum: ['str', 'dex', 'con', 'int', 'wis', 'cha', 'none'],
          description: 'Ability to test, or "none" when no roll is needed.',
        },
        dc: {
          type: Type.NUMBER,
          description: 'Difficulty class (typically 5-25). 0 if no roll.',
        },
        reason: {
          type: Type.STRING,
          description: 'Short reason for the check. Empty when none.',
        },
      },
      required: ['needed', 'ability', 'dc', 'reason'],
      propertyOrdering: ['needed', 'ability', 'dc', 'reason'],
    },
    state_updates: {
      type: Type.ARRAY,
      description:
        'Proposed changes to the character. Empty array if nothing changes.',
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            enum: [
              'hp_delta',
              'inventory_add',
              'inventory_remove',
              'status_add',
              'status_remove',
            ],
          },
          payload: {
            type: Type.OBJECT,
            description:
              'For hp_delta: {amount:number}. inventory_add: {name,description,quantity}. inventory_remove: {name,quantity}. status_add: {name,description}. status_remove: {name}.',
            properties: {
              amount: { type: Type.NUMBER },
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
            },
          },
          reason: { type: Type.STRING },
        },
        required: ['type', 'payload', 'reason'],
        propertyOrdering: ['type', 'payload', 'reason'],
      },
    },
  },
  required: ['narration', 'dice_request', 'state_updates'],
  propertyOrdering: ['narration', 'dice_request', 'state_updates'],
}

// Gemini responseSchema for the final character-sheet extraction.
export const CHARACTER_SHEET_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    characterName: { type: Type.STRING },
    archetype: { type: Type.STRING },
    backstory: { type: Type.STRING },
    stats: {
      type: Type.OBJECT,
      properties: {
        str: { type: Type.NUMBER },
        dex: { type: Type.NUMBER },
        con: { type: Type.NUMBER },
        int: { type: Type.NUMBER },
        wis: { type: Type.NUMBER },
        cha: { type: Type.NUMBER },
      },
      required: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
      propertyOrdering: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
    },
    maxHp: {
      type: Type.NUMBER,
      description: 'Starting max HP, roughly 8 + con modifier + 2.',
    },
    inventory: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
        },
        required: ['name', 'description', 'quantity'],
        propertyOrdering: ['name', 'description', 'quantity'],
      },
    },
  },
  required: ['characterName', 'archetype', 'backstory', 'stats', 'maxHp', 'inventory'],
  propertyOrdering: [
    'characterName',
    'archetype',
    'backstory',
    'stats',
    'maxHp',
    'inventory',
  ],
}
