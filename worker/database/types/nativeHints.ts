/**
 * Typed discriminated union for `models.native_hints`.
 *
 * This mirrors §2.6.4 of the Nas LangGraph migration plan exactly. The JSON
 * Schemas under `schemas/native-hints/` are the write-time enforcement of the
 * same contract — if you change one you MUST change the other.
 */

export interface GeminiSafetySetting {
    category: string;
    threshold: string;
}

export type NativeHints =
    | GeminiNativeHints
    | OpenAICompatNativeHints
    | AnthropicNativeHints
    | ElevenLabsNativeHints
    | RunwayNativeHints
    | VeoNativeHints
    | ReplicateNativeHints
    | LangflowNativeHints
    | UnknownNativeHints;

export interface GeminiNativeHints {
    provider: 'gemini';
    useSystemInstruction?: boolean;
    thinkingBudget?: number;
    safetySettings?: GeminiSafetySetting[];
}

export interface OpenAICompatNativeHints {
    provider: 'openai-compat';
    reasoningEffort?: 'low' | 'medium' | 'high';
}

export interface AnthropicNativeHints {
    provider: 'anthropic';
    thinking?: {
        type: 'enabled';
        budget_tokens: number;
    };
}

export interface ElevenLabsNativeHints {
    provider: 'elevenlabs';
    voiceId: string;
    stability?: number;
    similarityBoost?: number;
}

export interface RunwayNativeHints {
    provider: 'runway';
    model: 'gen3' | 'gen3-turbo';
    duration?: number;
    motionScale?: number;
}

export interface VeoNativeHints {
    provider: 'veo';
    aspectRatio?: '16:9' | '9:16';
    personGeneration?: 'allow' | 'block';
}

export interface ReplicateNativeHints {
    provider: 'replicate';
    replicateModelSlug: string;
    schemaOverrides?: Record<string, unknown>;
}

export interface LangflowNativeHints {
    provider: 'langflow';
    flowId: string;
    inputMapping?: Record<string, string>;
}

/**
 * Escape hatch for providers we haven't formally modeled. Adapters MUST
 * narrow `raw` before use (§0.3.6(1)).
 */
export interface UnknownNativeHints {
    provider: 'unknown';
    raw: Record<string, unknown>;
}

export const KNOWN_NATIVE_HINT_PROVIDERS = [
    'gemini',
    'openai-compat',
    'anthropic',
    'elevenlabs',
    'runway',
    'veo',
    'replicate',
    'langflow',
    'unknown',
] as const;

export type NativeHintProvider = (typeof KNOWN_NATIVE_HINT_PROVIDERS)[number];

export function isKnownNativeHintProvider(value: string): value is NativeHintProvider {
    return (KNOWN_NATIVE_HINT_PROVIDERS as readonly string[]).includes(value);
}
