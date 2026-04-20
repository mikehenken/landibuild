/**
 * Write-time validation of `models.native_hints` against the per-provider
 * JSON Schemas under `schemas/native-hints/`.
 *
 * Returns a structured result distinguishing:
 *   - valid: true
 *   - NATIVE_HINTS_UNKNOWN_PROVIDER: payload's `provider` is not a known variant
 *   - NATIVE_HINTS_INVALID_FIELD: provider is known but fields fail the branch schema
 */

import { Validator, type OutputUnit } from '@cfworker/json-schema';
import nativeHintsSchema from '../../../../schemas/native-hints/native-hints.schema.json';
import geminiSchema from '../../../../schemas/native-hints/gemini.schema.json';
import openaiCompatSchema from '../../../../schemas/native-hints/openai-compat.schema.json';
import anthropicSchema from '../../../../schemas/native-hints/anthropic.schema.json';
import elevenlabsSchema from '../../../../schemas/native-hints/elevenlabs.schema.json';
import runwaySchema from '../../../../schemas/native-hints/runway.schema.json';
import veoSchema from '../../../../schemas/native-hints/veo.schema.json';
import replicateSchema from '../../../../schemas/native-hints/replicate.schema.json';
import langflowSchema from '../../../../schemas/native-hints/langflow.schema.json';
import unknownSchema from '../../../../schemas/native-hints/unknown.schema.json';
import {
    isKnownNativeHintProvider,
    KNOWN_NATIVE_HINT_PROVIDERS,
} from '../../../database/types/nativeHints';

const rootValidator = new Validator(nativeHintsSchema as any);
rootValidator.addSchema(geminiSchema as any, 'gemini.schema.json');
rootValidator.addSchema(openaiCompatSchema as any, 'openai-compat.schema.json');
rootValidator.addSchema(anthropicSchema as any, 'anthropic.schema.json');
rootValidator.addSchema(elevenlabsSchema as any, 'elevenlabs.schema.json');
rootValidator.addSchema(runwaySchema as any, 'runway.schema.json');
rootValidator.addSchema(veoSchema as any, 'veo.schema.json');
rootValidator.addSchema(replicateSchema as any, 'replicate.schema.json');
rootValidator.addSchema(langflowSchema as any, 'langflow.schema.json');
rootValidator.addSchema(unknownSchema as any, 'unknown.schema.json');

/**
 * Per-variant validators keyed by discriminator value. Used so the controller
 * can return `NATIVE_HINTS_INVALID_FIELD` with branch-specific errors instead
 * of the less useful root `oneOf` aggregate error.
 */
const branchValidators: Record<string, Validator> = {
    gemini: new Validator(geminiSchema as any),
    'openai-compat': new Validator(openaiCompatSchema as any),
    anthropic: new Validator(anthropicSchema as any),
    elevenlabs: new Validator(elevenlabsSchema as any),
    runway: new Validator(runwaySchema as any),
    veo: new Validator(veoSchema as any),
    replicate: new Validator(replicateSchema as any),
    langflow: new Validator(langflowSchema as any),
    unknown: new Validator(unknownSchema as any),
};

export type NativeHintsValidationResult =
    | { ok: true }
    | {
          ok: false;
          code: 'NATIVE_HINTS_UNKNOWN_PROVIDER' | 'NATIVE_HINTS_INVALID_FIELD';
          errors: OutputUnit[];
          message: string;
      };

function extractProvider(value: unknown): string | null {
    if (value === null || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const provider = record.provider;
    return typeof provider === 'string' ? provider : null;
}

export function validateNativeHints(input: unknown): NativeHintsValidationResult {
    const provider = extractProvider(input);
    if (provider === null) {
        return {
            ok: false,
            code: 'NATIVE_HINTS_UNKNOWN_PROVIDER',
            errors: [],
            message: `native_hints must be an object with a string 'provider' field (known providers: ${KNOWN_NATIVE_HINT_PROVIDERS.join(', ')})`,
        };
    }

    if (!isKnownNativeHintProvider(provider)) {
        return {
            ok: false,
            code: 'NATIVE_HINTS_UNKNOWN_PROVIDER',
            errors: [],
            message: `Unknown native_hints provider '${provider}'. Known providers: ${KNOWN_NATIVE_HINT_PROVIDERS.join(', ')}`,
        };
    }

    const branch = branchValidators[provider];
    const outcome = branch.validate(input);
    if (outcome.valid) {
        return { ok: true };
    }
    return {
        ok: false,
        code: 'NATIVE_HINTS_INVALID_FIELD',
        errors: outcome.errors,
        message: `Invalid native_hints for provider '${provider}': ${outcome.errors
            .map((e) => e.error)
            .join('; ')}`,
    };
}

/** Backwards-compat wrapper — legacy callers expect { valid, errors }. */
export const nativeHintsValidator = {
    validate(input: unknown): { valid: boolean; errors: OutputUnit[] } {
        const result = validateNativeHints(input);
        if (result.ok) return { valid: true, errors: [] };
        return { valid: false, errors: result.errors };
    },
};
