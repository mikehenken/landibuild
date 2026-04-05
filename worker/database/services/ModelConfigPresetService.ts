/**
 * User-scoped named presets of model overrides (bundles across agent actions).
 */

import { BaseService } from './BaseService';
import { userModelConfigPresets } from '../schema';
import { eq, and, desc } from 'drizzle-orm';
import { generateId } from '../../utils/idGenerator';
import type { AgentActionKey } from '../../agents/inferutils/config.types';
import { AGENT_CONFIG } from '../../agents/inferutils/config';
import { type PresetConfigsMap, isPresetAgentActionKey } from '../../agents/inferutils/modelConfigPresetMap';
import { ModelConfigService } from './ModelConfigService';
import type { UserModelConfigWithMetadata } from '../types';

export type { PresetAgentEntry, PresetConfigsMap } from '../../agents/inferutils/modelConfigPresetMap';

export interface UserModelConfigPresetSummary {
	id: string;
	name: string;
	description: string | null;
	agentActionCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface UserModelConfigPresetDetail extends UserModelConfigPresetSummary {
	configs: PresetConfigsMap;
}

function isoFromSqliteTimestamp(value: unknown): string {
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (typeof value === 'number') {
		return new Date(value < 1_000_000_000_000 ? value * 1000 : value).toISOString();
	}
	return new Date().toISOString();
}

function parseConfigsJson(raw: string): PresetConfigsMap {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw) as unknown;
	} catch {
		throw new Error('Invalid preset payload');
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('Invalid preset payload');
	}
	const out: PresetConfigsMap = {};
	for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
		if (!isPresetAgentActionKey(k)) {
			continue;
		}
		if (v === null || typeof v !== 'object' || Array.isArray(v)) {
			continue;
		}
		const entry = v as Record<string, unknown>;
		out[k] = {
			modelName: typeof entry.modelName === 'string' ? entry.modelName : entry.modelName === null ? null : undefined,
			maxTokens: typeof entry.maxTokens === 'number' ? entry.maxTokens : entry.maxTokens === null ? null : undefined,
			temperature: typeof entry.temperature === 'number' ? entry.temperature : entry.temperature === null ? null : undefined,
			reasoningEffort:
				typeof entry.reasoningEffort === 'string'
					? entry.reasoningEffort
					: entry.reasoningEffort === null
						? null
						: undefined,
			fallbackModel:
				typeof entry.fallbackModel === 'string'
					? entry.fallbackModel
					: entry.fallbackModel === null
						? null
						: undefined,
		};
	}
	return out;
}

export class ModelConfigPresetService extends BaseService {
	async listPresets(userId: string): Promise<UserModelConfigPresetSummary[]> {
		const rows = await this.database
			.select()
			.from(userModelConfigPresets)
			.where(eq(userModelConfigPresets.userId, userId))
			.orderBy(desc(userModelConfigPresets.updatedAt));

		return rows.map((row) => {
			const configs = parseConfigsJson(row.configsJson);
			const agentActionCount = Object.keys(configs).length;
			return {
				id: row.id,
				name: row.name,
				description: row.description ?? null,
				agentActionCount,
				createdAt: isoFromSqliteTimestamp(row.createdAt),
				updatedAt: isoFromSqliteTimestamp(row.updatedAt),
			};
		});
	}

	async getPreset(userId: string, presetId: string): Promise<UserModelConfigPresetDetail | null> {
		const rows = await this.database
			.select()
			.from(userModelConfigPresets)
			.where(and(eq(userModelConfigPresets.userId, userId), eq(userModelConfigPresets.id, presetId)))
			.limit(1);
		if (rows.length === 0) {
			return null;
		}
		const row = rows[0];
		const configs = parseConfigsJson(row.configsJson);
		return {
			id: row.id,
			name: row.name,
			description: row.description ?? null,
			agentActionCount: Object.keys(configs).length,
			createdAt: isoFromSqliteTimestamp(row.createdAt),
			updatedAt: isoFromSqliteTimestamp(row.updatedAt),
			configs,
		};
	}

	async createPreset(
		userId: string,
		name: string,
		description: string | null,
		configs: PresetConfigsMap,
	): Promise<UserModelConfigPresetDetail> {
		const keys = Object.keys(configs);
		if (keys.length === 0) {
			throw new Error('Preset must include at least one agent configuration');
		}
		for (const k of keys) {
			if (!isPresetAgentActionKey(k)) {
				throw new Error(`Unknown agent action: ${k}`);
			}
		}
		const id = generateId();
		const now = new Date();
		const configsJson = JSON.stringify(configs);
		await this.database.insert(userModelConfigPresets).values({
			id,
			userId,
			name: name.trim(),
			description: description?.trim() || null,
			configsJson,
			createdAt: now,
			updatedAt: now,
		});
		const detail = await this.getPreset(userId, id);
		if (!detail) {
			throw new Error('Failed to create preset');
		}
		return detail;
	}

	async createFromCurrentOverrides(
		userId: string,
		name: string,
		description: string | null,
	): Promise<UserModelConfigPresetDetail> {
		const modelConfigService = new ModelConfigService(this.env);
		const merged = await modelConfigService.getUserModelConfigs(userId);
		const configs: PresetConfigsMap = {};
		for (const key of Object.keys(AGENT_CONFIG)) {
			const action = key as AgentActionKey;
			const m: UserModelConfigWithMetadata = merged[action];
			if (!m.isUserOverride) {
				continue;
			}
			configs[action] = {
				modelName: m.name,
				maxTokens: m.max_tokens ?? null,
				temperature: m.temperature ?? null,
				reasoningEffort: m.reasoning_effort ?? null,
				fallbackModel: m.fallbackModel ?? null,
			};
		}
		if (Object.keys(configs).length === 0) {
			throw new Error('No custom model overrides to save; configure agents first');
		}
		return this.createPreset(userId, name, description, configs);
	}

	async deletePreset(userId: string, presetId: string): Promise<boolean> {
		const deleted = await this.database
			.delete(userModelConfigPresets)
			.where(and(eq(userModelConfigPresets.userId, userId), eq(userModelConfigPresets.id, presetId)))
			.returning();
		return deleted.length > 0;
	}
}
