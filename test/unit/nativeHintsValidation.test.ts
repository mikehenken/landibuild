import { describe, it, expect } from 'vitest';
import { validateNativeHints } from '../../worker/api/controllers/models/nativeHintsValidator';

describe('Schema validation for native_hints', () => {
    it('should pass for a valid openai-compat hint', () => {
        const hint = {
            provider: 'openai-compat',
            reasoningEffort: 'low'
        };
        const validation = validateNativeHints(hint);
        expect(validation.ok).toBe(true);
    });

    it('should pass for a valid gemini hint', () => {
        const hint = {
            provider: 'gemini',
            useSystemInstruction: true,
            safetySettings: []
        };
        const validation = validateNativeHints(hint);
        expect(validation.ok).toBe(true);
    });

    it('should fail for an unknown provider variant with specific error code', () => {
        const hint = {
            provider: 'bogus',
            something: 'else'
        };
        const validation = validateNativeHints(hint);
        expect(validation.ok).toBe(false);
        if (!validation.ok) {
            expect(validation.code).toBe('NATIVE_HINTS_UNKNOWN_PROVIDER');
        }
    });

    it('should fail for a known provider with invalid fields', () => {
        const hint = {
            provider: 'gemini',
            safetySettings: [ { invalid: 'category' } ]
        };
        const validation = validateNativeHints(hint);
        expect(validation.ok).toBe(false);
        if (!validation.ok) {
            expect(validation.code).toBe('NATIVE_HINTS_INVALID_FIELD');
        }
    });
});
