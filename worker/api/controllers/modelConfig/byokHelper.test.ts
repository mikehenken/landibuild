import { describe, it, expect } from 'vitest';
import { AIModels } from '../../../agents/inferutils/config.types';
import {
	getAccessProviderFromModelId,
	getByokModels,
	getPlatformAvailableModels,
	getPlatformEnabledProviders,
	getProviderFromModel,
	validateModelAccessForEnvironment,
} from './byokHelper';
import type { UserProviderStatus } from './types';

function minimalEnv(overrides: Partial<Env> = {}): Env {
	return {
		...overrides,
	} as Env;
}

describe('byokHelper', () => {
	describe('getAccessProviderFromModelId', () => {
		it('maps workers-ai prefix to workers', () => {
			expect(getAccessProviderFromModelId(AIModels.KIMI_2_5)).toBe('workers');
			expect(getAccessProviderFromModelId('workers-ai/@cf/moonshotai/kimi-k2.5')).toBe('workers');
		});

		it('keeps openai for openai/gpt-style ids', () => {
			expect(getAccessProviderFromModelId(AIModels.OPENAI_5_MINI)).toBe('openai');
			expect(getAccessProviderFromModelId('openai/gpt-5-mini')).toBe('openai');
		});

		it('returns cloudflare for ids without a slash (getProviderFromModel)', () => {
			expect(getProviderFromModel(AIModels.DISABLED)).toBe('cloudflare');
			expect(getAccessProviderFromModelId(AIModels.DISABLED)).toBe('cloudflare');
		});
	});

	describe('getPlatformEnabledProviders', () => {
		it('with no PLATFORM_MODEL_PROVIDERS and valid WORKERS_API_KEY includes workers', () => {
			const env = minimalEnv({
				WORKERS_API_KEY: '1234567890ab',
			});
			expect(getPlatformEnabledProviders(env)).toContain('workers');
		});

		it('does not add workers when WORKERS_API_KEY is missing, too short, none, or default', () => {
			expect(getPlatformEnabledProviders(minimalEnv({}))).not.toContain('workers');
			expect(getPlatformEnabledProviders(minimalEnv({ WORKERS_API_KEY: 'short' }))).not.toContain(
				'workers',
			);
			expect(
				getPlatformEnabledProviders(minimalEnv({ WORKERS_API_KEY: 'none' })),
			).not.toContain('workers');
			expect(
				getPlatformEnabledProviders(minimalEnv({ WORKERS_API_KEY: 'default' })),
			).not.toContain('workers');
		});

		it('merges workers into PLATFORM_MODEL_PROVIDERS when list omits workers but key is valid', () => {
			const env = minimalEnv({
				PLATFORM_MODEL_PROVIDERS: 'anthropic, openai',
				WORKERS_API_KEY: '1234567890ab',
			});
			const providers = getPlatformEnabledProviders(env);
			expect(providers).toContain('anthropic');
			expect(providers).toContain('openai');
			expect(providers).toContain('workers');
		});

		it('adds openai when OPENAI_API_KEY is valid', () => {
			const env = minimalEnv({
				OPENAI_API_KEY: 'sk-1234567890',
			});
			expect(getPlatformEnabledProviders(env)).toContain('openai');
		});
	});

	describe('getPlatformAvailableModels', () => {
		it('when workers enabled, includes known chat Workers AI models and excludes image modality models', () => {
			const env = minimalEnv({ WORKERS_API_KEY: '1234567890ab' });
			const models = getPlatformAvailableModels(env);

			expect(models).toContain(AIModels.KIMI_2_5);
			expect(models).toContain(AIModels.WORKERS_GLM_4_7_FLASH);
			expect(models).not.toContain(AIModels.WORKERS_FLUX_2_KLEIN_9B);
			expect(models).not.toContain(AIModels.WORKERS_LEONARDO_LUCID_ORIGIN);
		});
	});

	describe('getByokModels', () => {
		it('with workers hasValidKey true includes chat workers-ai ids and excludes image ids', () => {
			const statuses: UserProviderStatus[] = [{ provider: 'workers', hasValidKey: true }];
			const byok = getByokModels(statuses);
			const workersModels = byok.workers ?? [];

			expect(workersModels.length).toBeGreaterThan(0);
			expect(workersModels).toContain(AIModels.KIMI_2_5);
			expect(workersModels).not.toContain(AIModels.WORKERS_FLUX_2_KLEIN_9B);
			expect(workersModels).not.toContain(AIModels.WORKERS_LEONARDO_LUCID_ORIGIN);
		});

		it('with workers hasValidKey false yields no models for workers', () => {
			const statuses: UserProviderStatus[] = [{ provider: 'workers', hasValidKey: false }];
			const byok = getByokModels(statuses);
			expect(byok.workers).toBeUndefined();
		});
	});

	describe('validateModelAccessForEnvironment', () => {
		const workersChatModel = AIModels.KIMI_2_5;

		it('returns true for chat workers-ai model with platform WORKERS_API_KEY and empty user status', () => {
			const env = minimalEnv({ WORKERS_API_KEY: '1234567890ab' });
			const userStatus: UserProviderStatus[] = [];
			expect(validateModelAccessForEnvironment(workersChatModel, env, userStatus)).toBe(true);
		});

		it('returns true with user workers key only (no platform key)', () => {
			const env = minimalEnv({});
			const userStatus: UserProviderStatus[] = [{ provider: 'workers', hasValidKey: true }];
			expect(validateModelAccessForEnvironment(workersChatModel, env, userStatus)).toBe(true);
		});

		it('returns false when neither platform nor user has workers access', () => {
			const env = minimalEnv({});
			const userStatus: UserProviderStatus[] = [{ provider: 'workers', hasValidKey: false }];
			expect(validateModelAccessForEnvironment(workersChatModel, env, userStatus)).toBe(false);
		});
	});
});
