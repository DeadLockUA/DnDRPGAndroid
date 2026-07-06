import { EN, type Dictionary } from './en'
import { RU } from './ru'
import type { Language, AbilityOrNone } from '../api/types'

export type { Dictionary }

export const DICTIONARIES: Record<Language, Dictionary> = {
  en: EN,
  ru: RU,
}

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  ru: 'Русский',
}

export function getDictionary(lang: Language): Dictionary {
  return DICTIONARIES[lang]
}

/** Replace {token} placeholders with values. */
export function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  )
}

const ABILITY_NAMES: Record<Language, Record<AbilityOrNone, string>> = {
  en: {
    str: 'Strength',
    dex: 'Dexterity',
    con: 'Constitution',
    int: 'Intelligence',
    wis: 'Wisdom',
    cha: 'Charisma',
    none: '—',
  },
  ru: {
    str: 'Сила',
    dex: 'Ловкость',
    con: 'Телосложение',
    int: 'Интеллект',
    wis: 'Мудрость',
    cha: 'Харизма',
    none: '—',
  },
}

export function abilityName(ability: AbilityOrNone, lang: Language): string {
  return ABILITY_NAMES[lang][ability]
}
