import { describe, it, expect } from 'vitest';
import {
	isValidAIModel,
	isChatCompletionAIModel,
	toAIModel,
	credentialsToRuntimeOverrides,
	AIModels,
} from './config.types';

describe('isValidAIModel', () => {
	it('returns true for a registered chat model', () => {
		expect(isValidAIModel(AIModels.KIMI_2_5)).toBe(true);
		expect(isValidAIModel(AIModels.GEMINI_2_5_FLASH)).toBe(true);
		expect(isValidAIModel(AIModels.GROK_4_1_FAST_NON_REASONING)).toBe(true);
	});

	it('returns true for the DISABLED sentinel', () => {
		expect(isValidAIModel(AIModels.DISABLED)).toBe(true);
	});

	it('returns false for an unknown model id', () => {
		expect(isValidAIModel('not-a-real-model')).toBe(false);
		expect(isValidAIModel('')).toBe(false);
	});
});

describe('isChatCompletionAIModel', () => {
	it('returns true for registered chat models', () => {
		expect(isChatCompletionAIModel(AIModels.KIMI_2_5)).toBe(true);
		expect(isChatCompletionAIModel(AIModels.GEMINI_2_5_PRO)).toBe(true);
		expect(isChatCompletionAIModel(AIModels.GROK_4_1_FAST)).toBe(true);
	});

	it('returns false for image generation models', () => {
		expect(isChatCompletionAIModel(AIModels.WORKERS_FLUX_2_KLEIN_9B)).toBe(false);
		expect(isChatCompletionAIModel(AIModels.WORKERS_LEONARDO_LUCID_ORIGIN)).toBe(false);
	});

	it('returns true for unknown model ids (fail-open policy)', () => {
		expect(isChatCompletionAIModel('unknown/model-xyz')).toBe(true);
	});
});

describe('toAIModel', () => {
	it('returns the model id for a valid registered model', () => {
		expect(toAIModel(AIModels.KIMI_2_5)).toBe(AIModels.KIMI_2_5);
		expect(toAIModel(AIModels.GEMINI_2_5_FLASH)).toBe(AIModels.GEMINI_2_5_FLASH);
	});

	it('returns undefined for an invalid model id string', () => {
		expect(toAIModel('not-a-model')).toBeUndefined();
	});

	it('returns undefined for null', () => {
		expect(toAIModel(null)).toBeUndefined();
	});

	it('returns undefined for undefined', () => {
		expect(toAIModel(undefined)).toBeUndefined();
	});
});

describe('credentialsToRuntimeOverrides', () => {
	it('returns undefined when credentials is undefined', () => {
		expect(credentialsToRuntimeOverrides(undefined)).toBeUndefined();
	});

	it('maps provider api keys into userApiKeys', () => {
		const result = credentialsToRuntimeOverrides({
			providers: {
				openai: { apiKey: 'sk-test' },
				anthropic: { apiKey: 'ant-test' },
			},
		});
		expect(result?.userApiKeys?.openai).toBe('sk-test');
		expect(result?.userApiKeys?.anthropic).toBe('ant-test');
	});

	it('omits userApiKeys when no provider keys are present', () => {
		const result = credentialsToRuntimeOverrides({ providers: {} });
		expect(result?.userApiKeys).toBeUndefined();
	});

	it('maps the aiGateway override', () => {
		const result = credentialsToRuntimeOverrides({
			aiGateway: { baseUrl: 'https://gateway.example.com', token: 'gw-token' },
		});
		expect(result?.aiGatewayOverride?.baseUrl).toBe('https://gateway.example.com');
		expect(result?.aiGatewayOverride?.token).toBe('gw-token');
	});

	it('maps both providers and aiGateway together', () => {
		const result = credentialsToRuntimeOverrides({
			providers: { grok: { apiKey: 'grok-key' } },
			aiGateway: { baseUrl: 'https://gw.example.com', token: 'tok' },
		});
		expect(result?.userApiKeys?.grok).toBe('grok-key');
		expect(result?.aiGatewayOverride).toBeDefined();
	});
});
