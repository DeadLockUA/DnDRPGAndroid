import { GoogleGenAI, type Content } from '@google/genai'
import type {
  Settings,
  DMResponse,
  ChatMessage,
  CharacterSheet,
  CreationReply,
  Language,
} from './types'
import { GeminiError } from './types'
import { classifyGeminiError } from './error-handler'
import {
  DM_RESPONSE_SCHEMA,
  CHARACTER_SHEET_SCHEMA,
  CREATION_REPLY_SCHEMA,
} from './schemas'
import {
  buildDMSystemPrompt,
  buildCharacterCreationSystemPrompt,
  buildCharacterExtractionInstruction,
  buildSummaryPrompt,
} from './prompts'
import type { GameSession } from './types'

/** Map our chat roles to Gemini content roles. */
function toContents(messages: ChatMessage[]): Content[] {
  return messages.map((m) => ({
    role: m.role === 'dm' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
}

export class GeminiClient {
  private ai: GoogleGenAI | null = null
  private settings: Settings

  constructor(settings: Settings) {
    this.settings = settings
    this.rebuild()
  }

  updateSettings(settings: Settings): void {
    this.settings = settings
    this.rebuild()
  }

  private rebuild(): void {
    this.ai = this.settings.apiKey
      ? new GoogleGenAI({ apiKey: this.settings.apiKey })
      : null
  }

  private client(): GoogleGenAI {
    if (!this.ai) {
      throw new GeminiError('NO_KEY', 'No Gemini API key configured.')
    }
    return this.ai
  }

  /** Lightweight call to confirm the key/model work. */
  async validateApiKey(): Promise<void> {
    try {
      const res = await this.client().models.generateContent({
        model: this.settings.geminiModel,
        contents: 'ping',
        config: { maxOutputTokens: 8 },
      })
      // Touch the accessor so an empty/blocked response still surfaces.
      void res.text
    } catch (error) {
      throw classifyGeminiError(error)
    }
  }

  /** One DM turn. Retries once on malformed JSON with a corrective note. */
  async generateDMTurn(
    session: GameSession,
    messages: ChatMessage[],
    language: Language,
  ): Promise<DMResponse> {
    const systemInstruction = buildDMSystemPrompt(session, language)
    const contents = toContents(messages)

    try {
      return await this.callDM(systemInstruction, contents)
    } catch (error) {
      const classified = classifyGeminiError(error)
      if (classified.code !== 'MALFORMED_RESPONSE') throw classified
      // Retry once with a corrective instruction appended.
      const retryContents: Content[] = [
        ...contents,
        {
          role: 'user',
          parts: [
            {
              text: 'Your previous reply was not valid JSON. Respond again with ONLY the JSON object matching the schema.',
            },
          ],
        },
      ]
      return this.callDM(systemInstruction, retryContents)
    }
  }

  private async callDM(
    systemInstruction: string,
    contents: Content[],
  ): Promise<DMResponse> {
    let text: string
    try {
      const res = await this.client().models.generateContent({
        model: this.settings.geminiModel,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: DM_RESPONSE_SCHEMA,
        },
      })
      text = res.text ?? ''
    } catch (error) {
      throw classifyGeminiError(error)
    }
    return parseJson<DMResponse>(text)
  }

  /** One character-creation reply plus a readiness flag (structured). */
  async generateCreationReply(
    history: ChatMessage[],
    language: Language,
  ): Promise<CreationReply> {
    let text: string
    try {
      const res = await this.client().models.generateContent({
        model: this.settings.geminiModel,
        contents: toContents(history),
        config: {
          systemInstruction: buildCharacterCreationSystemPrompt(language),
          responseMimeType: 'application/json',
          responseSchema: CREATION_REPLY_SCHEMA,
        },
      })
      text = res.text ?? ''
    } catch (error) {
      throw classifyGeminiError(error)
    }
    const parsed = parseJson<CreationReply>(text)
    return { message: parsed.message ?? '', ready: !!parsed.ready }
  }

  /** Convert the creation conversation into a structured sheet. */
  async extractCharacterSheet(
    history: ChatMessage[],
    language: Language,
  ): Promise<CharacterSheet> {
    const contents: Content[] = [
      ...toContents(history),
      {
        role: 'user',
        parts: [{ text: buildCharacterExtractionInstruction(language) }],
      },
    ]
    let text: string
    try {
      const res = await this.client().models.generateContent({
        model: this.settings.geminiModel,
        contents,
        config: {
          responseMimeType: 'application/json',
          responseSchema: CHARACTER_SHEET_SCHEMA,
        },
      })
      text = res.text ?? ''
    } catch (error) {
      throw classifyGeminiError(error)
    }
    return parseJson<CharacterSheet>(text)
  }

  /** Compact a transcript into a prose summary. */
  async summarize(transcript: string, language: Language): Promise<string> {
    try {
      const res = await this.client().models.generateContent({
        model: this.settings.geminiModel,
        contents: transcript,
        config: { systemInstruction: buildSummaryPrompt(language) },
      })
      return res.text ?? ''
    } catch (error) {
      throw classifyGeminiError(error)
    }
  }
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    throw new GeminiError(
      'MALFORMED_RESPONSE',
      'Model returned invalid JSON: ' + text.slice(0, 200),
    )
  }
}
