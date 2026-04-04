import { describe, it, expect } from 'vitest';
import { AGENT_CONSTRAINTS } from './config';
import { AIModels } from './config.types';

describe('AGENT_CONSTRAINTS', () => {
	it('contains a constraint for fastCodeFixer', () => {
		expect(AGENT_CONSTRAINTS.has('fastCodeFixer')).toBe(true);
	});

	it('fastCodeFixer constraint is enabled and allows Workers AI models', () => {
		const constraint = AGENT_CONSTRAINTS.get('fastCodeFixer')!;
		expect(constraint.enabled).toBe(true);
		expect(constraint.allowedModels.has(AIModels.KIMI_2_5)).toBe(true);
		expect(constraint.allowedModels.has(AIModels.GROK_4_1_FAST_NON_REASONING)).toBe(true);
		expect(constraint.allowedModels.has(AIModels.GEMINI_2_5_FLASH)).toBe(true);
	});

	it('fastCodeFixer allows the DISABLED sentinel', () => {
		const constraint = AGENT_CONSTRAINTS.get('fastCodeFixer')!;
		expect(constraint.allowedModels.has(AIModels.DISABLED)).toBe(true);
	});

	it('fastCodeFixer does not allow image-only models', () => {
		const constraint = AGENT_CONSTRAINTS.get('fastCodeFixer')!;
		expect(constraint.allowedModels.has(AIModels.WORKERS_FLUX_2_KLEIN_9B)).toBe(false);
		expect(constraint.allowedModels.has(AIModels.WORKERS_LEONARDO_LUCID_ORIGIN)).toBe(false);
	});

	it('contains a constraint for realtimeCodeFixer and it is enabled', () => {
		const constraint = AGENT_CONSTRAINTS.get('realtimeCodeFixer')!;
		expect(constraint).toBeDefined();
		expect(constraint.enabled).toBe(true);
	});

	it('realtimeCodeFixer uses the same allowed set as fastCodeFixer', () => {
		const fast = AGENT_CONSTRAINTS.get('fastCodeFixer')!;
		const realtime = AGENT_CONSTRAINTS.get('realtimeCodeFixer')!;
		expect(fast.allowedModels).toBe(realtime.allowedModels);
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
