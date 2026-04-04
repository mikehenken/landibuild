import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIModels } from '../../agents/inferutils/config.types';

vi.mock('../database', () => ({
	createDatabaseService: vi.fn(() => ({
		db: {},
		getHealthStatus: vi.fn(async () => ({
			healthy: true,
			timestamp: new Date().toISOString(),
		})),
		getReadDb: vi.fn(function (this: { db: Record<string, unknown> }) {
			return this.db;
		}),
	})),
	DatabaseService: class DatabaseService {},
}));

vi.mock('../../agents/inferutils/core', async () => {
	const { vi: vitest } = await import('vitest');
	return {
		infer: vitest.fn(),
		InferError: class InferError extends Error {
			override name = 'InferError';
		},
	};
});

import { infer } from '../../agents/inferutils/core';
import { ModelTestService } from './ModelTestService';

describe('ModelTestService', () => {
	let service: ModelTestService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new ModelTestService({} as Env);
	});

	describe('testModelConfig', () => {
		it('returns success false and does not call infer for an image model', async () => {
			const inferMock = vi.mocked(infer);
			const result = await service.testModelConfig({
				modelConfig: {
					name: AIModels.WORKERS_FLUX_2_KLEIN_9B,
					max_tokens: 100,
					temperature: 0.1,
				},
				userId: 'test-user-1',
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('image');
			expect(result.latencyMs).toBe(0);
			expect(inferMock).not.toHaveBeenCalled();
		});

		it('returns success false for Leonardo image model without calling infer', async () => {
			const inferMock = vi.mocked(infer);
			const result = await service.testModelConfig({
				modelConfig: { name: AIModels.WORKERS_LEONARDO_LUCID_ORIGIN },
				userId: 'test-user-2',
			});

			expect(result.success).toBe(false);
			expect(inferMock).not.toHaveBeenCalled();
		});
	});
});
