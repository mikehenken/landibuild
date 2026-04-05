import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelCatalogResolutionService } from './ModelCatalogResolutionService';

vi.mock('./ModelCatalogRevisionService', () => ({
	ModelCatalogRevisionService: class {
		async getRevision() {
			return 7;
		}
	},
}));

describe('ModelCatalogResolutionService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns revision from revision service and build-time fallback flag', async () => {
		const svc = new ModelCatalogResolutionService({} as Env);
		const resolved = await svc.resolveForUser('user-1');
		expect(resolved.revision).toBe(7);
		expect(resolved.fallbackToBuildTimeConfig).toBe(true);
		expect(resolved.defaultAgentActionKeys.length).toBeGreaterThan(0);
	});
});
