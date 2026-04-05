/**
 * Shared shapes and helpers for model configuration presets (user + built-in).
 */

import type { AgentActionKey, AgentConfig } from './config.types';

export interface PresetAgentEntry {
	modelName?: string | null;
	maxTokens?: number | null;
	temperature?: number | null;
	reasoningEffort?: string | null;
	fallbackModel?: string | null;
}

export type PresetConfigsMap = Partial<Record<AgentActionKey, PresetAgentEntry>>;

/** Stable ordering; must match {@link AgentConfig} keys. */
export const ALL_AGENT_ACTION_KEYS: readonly AgentActionKey[] = [
	'templateSelection',
	'blueprint',
	'projectSetup',
	'phaseGeneration',
	'phaseImplementation',
	'firstPhaseImplementation',
	'fileRegeneration',
	'screenshotAnalysis',
	'realtimeCodeFixer',
	'fastCodeFixer',
	'conversationalResponse',
	'deepDebugger',
	'agenticProjectBuilder',
] as const;

const AGENT_ACTION_KEY_SET: ReadonlySet<string> = new Set(ALL_AGENT_ACTION_KEYS);

export function isPresetAgentActionKey(key: string): key is AgentActionKey {
	return AGENT_ACTION_KEY_SET.has(key);
}

export function agentConfigToPresetConfigs(agent: AgentConfig): PresetConfigsMap {
	const out: PresetConfigsMap = {};
	for (const key of ALL_AGENT_ACTION_KEYS) {
		const c = agent[key];
		if (c == null) {
			continue;
		}
		out[key] = {
			modelName: typeof c.name === 'string' ? c.name : String(c.name),
			maxTokens: c.max_tokens ?? null,
			temperature: c.temperature ?? null,
			reasoningEffort: c.reasoning_effort ?? null,
			fallbackModel: c.fallbackModel != null ? String(c.fallbackModel) : null,
		};
	}
	return out;
}
