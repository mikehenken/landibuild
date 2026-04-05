import { describe, it, expect } from 'vitest';
import { AGENT_CONSTRAINTS } from './config';
import { AIModels } from './config.types';

describe('AGENT_CONSTRAINTS', () => {
	it('does not restrict fastCodeFixer (full model list in UI)', () => {
		expect(AGENT_CONSTRAINTS.has('fastCodeFixer')).toBe(false);
	});

	it('does not restrict realtimeCodeFixer (full model list in UI)', () => {
		expect(AGENT_CONSTRAINTS.has('realtimeCodeFixer')).toBe(false);
	});

	it('fileRegeneration allows all registered chat models', () => {
		const constraint = AGENT_CONSTRAINTS.get('fileRegeneration')!;
		expect(constraint).toBeDefined();
		expect(constraint.allowedModels.has(AIModels.KIMI_2_5)).toBe(true);
		expect(constraint.allowedModels.has(AIModels.GEMINI_3_PRO_PREVIEW)).toBe(true);
		expect(constraint.allowedModels.has(AIModels.CLAUDE_4_5_SONNET)).toBe(true);
	});

	it('fileRegeneration does not allow image models', () => {
		const constraint = AGENT_CONSTRAINTS.get('fileRegeneration')!;
		expect(constraint.allowedModels.has(AIModels.WORKERS_FLUX_2_KLEIN_9B)).toBe(false);
	});
});
