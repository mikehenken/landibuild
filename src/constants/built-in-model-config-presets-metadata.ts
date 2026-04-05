import type { ModelConfigPresetSummary } from '@/api-types';

/**
 * Display-only fallback when preset list API fails, omits built-ins, or does not set `isBuiltIn`.
 * Keep in sync with `worker/agents/inferutils/builtInModelConfigPresets.ts` (ids, names, descriptions).
 */
const BUILT_IN_PLACEHOLDER_TS = '1970-01-01T00:00:00.000Z';

/** Matches ALL_AGENT_ACTION_KEYS length in modelConfigPresetMap.ts */
const BUILTIN_PRESET_AGENT_ACTION_COUNT = 13;

export const BUILT_IN_MODEL_CONFIG_PRESET_SUMMARY_FALLBACK: readonly ModelConfigPresetSummary[] = [
	{
		id: 'builtin:openrouter-free',
		name: 'OpenRouter · Free (default)',
		description:
			'Free-tier OpenRouter models across agents. Requires an OpenRouter API key or BYOK.',
		agentActionCount: BUILTIN_PRESET_AGENT_ACTION_COUNT,
		createdAt: BUILT_IN_PLACEHOLDER_TS,
		updatedAt: BUILT_IN_PLACEHOLDER_TS,
		isBuiltIn: true,
	},
	{
		id: 'builtin:gemini-high',
		name: 'Gemini · High',
		description:
			'Gemini 3 Pro for blueprint; Flash for implementation. Google AI Studio access required.',
		agentActionCount: BUILTIN_PRESET_AGENT_ACTION_COUNT,
		createdAt: BUILT_IN_PLACEHOLDER_TS,
		updatedAt: BUILT_IN_PLACEHOLDER_TS,
		isBuiltIn: true,
	},
	{
		id: 'builtin:gemini-medium',
		name: 'Gemini · Medium',
		description: 'Gemini 3 Flash–centric workload. Google AI Studio access required.',
		agentActionCount: BUILTIN_PRESET_AGENT_ACTION_COUNT,
		createdAt: BUILT_IN_PLACEHOLDER_TS,
		updatedAt: BUILT_IN_PLACEHOLDER_TS,
		isBuiltIn: true,
	},
	{
		id: 'builtin:gemini-low',
		name: 'Gemini · Low',
		description: 'Gemini 2.5 Flash / Flash-Lite for lower cost. Google AI Studio access required.',
		agentActionCount: BUILTIN_PRESET_AGENT_ACTION_COUNT,
		createdAt: BUILT_IN_PLACEHOLDER_TS,
		updatedAt: BUILT_IN_PLACEHOLDER_TS,
		isBuiltIn: true,
	},
	{
		id: 'builtin:openrouter-high',
		name: 'OpenRouter · High',
		description: 'Premium OpenRouter routing (Gemini 3.1 Pro, Qwen Coder Next, GLM).',
		agentActionCount: BUILTIN_PRESET_AGENT_ACTION_COUNT,
		createdAt: BUILT_IN_PLACEHOLDER_TS,
		updatedAt: BUILT_IN_PLACEHOLDER_TS,
		isBuiltIn: true,
	},
	{
		id: 'builtin:openrouter-medium',
		name: 'OpenRouter · Medium',
		description: 'Balanced OpenRouter models (Gemini 2.5 Pro, GLM 4.7, Qwen3.5).',
		agentActionCount: BUILTIN_PRESET_AGENT_ACTION_COUNT,
		createdAt: BUILT_IN_PLACEHOLDER_TS,
		updatedAt: BUILT_IN_PLACEHOLDER_TS,
		isBuiltIn: true,
	},
	{
		id: 'builtin:openrouter-low',
		name: 'OpenRouter · Low',
		description: 'Efficient OpenRouter models (Flash-Lite, GLM 4.7 Flash).',
		agentActionCount: BUILTIN_PRESET_AGENT_ACTION_COUNT,
		createdAt: BUILT_IN_PLACEHOLDER_TS,
		updatedAt: BUILT_IN_PLACEHOLDER_TS,
		isBuiltIn: true,
	},
	{
		id: 'builtin:mix-high',
		name: 'Mix · High',
		description: 'Gemini blueprint + OpenRouter codegen + Grok chat.',
		agentActionCount: BUILTIN_PRESET_AGENT_ACTION_COUNT,
		createdAt: BUILT_IN_PLACEHOLDER_TS,
		updatedAt: BUILT_IN_PLACEHOLDER_TS,
		isBuiltIn: true,
	},
	{
		id: 'builtin:mix-medium',
		name: 'Mix · Medium',
		description: 'Gemini + OpenRouter GLM split across planning and coding.',
		agentActionCount: BUILTIN_PRESET_AGENT_ACTION_COUNT,
		createdAt: BUILT_IN_PLACEHOLDER_TS,
		updatedAt: BUILT_IN_PLACEHOLDER_TS,
		isBuiltIn: true,
	},
	{
		id: 'builtin:mix-low',
		name: 'Mix · Low',
		description: 'Lite Gemini and OpenRouter Flash models.',
		agentActionCount: BUILTIN_PRESET_AGENT_ACTION_COUNT,
		createdAt: BUILT_IN_PLACEHOLDER_TS,
		updatedAt: BUILT_IN_PLACEHOLDER_TS,
		isBuiltIn: true,
	},
];
