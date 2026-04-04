import { describe, it, expect, vi } from 'vitest';

// Mock database and other heavy transitive deps that pull in CJS-only modules
// (e.g. @modelcontextprotocol/sdk → ajv) which are incompatible with the
// Workers test pool's ESM runtime.
vi.mock('../../database', () => ({
	AppService: class MockAppService {
		getApp = vi.fn().mockResolvedValue(null);
	},
}));
vi.mock('../../services/rate-limit/rateLimits', () => ({
	RateLimitService: class MockRateLimitService {},
}));
vi.mock('./ticketAuth', () => ({
	authenticateViaTicket: vi.fn().mockResolvedValue(null),
	hasTicketParam: vi.fn().mockReturnValue(false),
}));

import { routeAuthChecks, AuthConfig } from './routeAuth';
import type { AuthUser } from '../../types/auth-types';

const mockUser: AuthUser = {
	id: 'user-123',
	email: 'test@example.com',
};

const emptyEnv = {} as Env;

describe('routeAuthChecks — public routes', () => {
	it('always succeeds without an authenticated user', async () => {
		const result = await routeAuthChecks(null, emptyEnv, AuthConfig.public);
		expect(result.success).toBe(true);
		expect(result.response).toBeUndefined();
	});

	it('also succeeds with an authenticated user', async () => {
		const result = await routeAuthChecks(mockUser, emptyEnv, AuthConfig.public);
		expect(result.success).toBe(true);
	});
});

describe('routeAuthChecks — authenticated routes', () => {
	it('returns success: false and HTTP 401 without a user', async () => {
		const result = await routeAuthChecks(null, emptyEnv, AuthConfig.authenticated);
		expect(result.success).toBe(false);
		expect(result.response).toBeDefined();
		expect(result.response!.status).toBe(401);
	});

	it('returns success: true with a valid authenticated user', async () => {
		const result = await routeAuthChecks(mockUser, emptyEnv, AuthConfig.authenticated);
		expect(result.success).toBe(true);
		expect(result.response).toBeUndefined();
	});
});

describe('routeAuthChecks — owner-only routes', () => {
	it('returns success: false and HTTP 401 without a user', async () => {
		const requirement = {
			required: true,
			level: 'owner-only' as const,
			resourceOwnershipCheck: async () => true,
		};
		const result = await routeAuthChecks(null, emptyEnv, requirement, { agentId: 'agent-1' });
		expect(result.success).toBe(false);
		expect(result.response!.status).toBe(401);
	});

	it('returns success: true when resourceOwnershipCheck passes', async () => {
		const requirement = {
			required: true,
			level: 'owner-only' as const,
			resourceOwnershipCheck: async () => true,
		};
		const result = await routeAuthChecks(mockUser, emptyEnv, requirement, { agentId: 'agent-1' });
		expect(result.success).toBe(true);
	});

	it('returns success: false with HTTP 403 when resourceOwnershipCheck fails', async () => {
		const requirement = {
			required: true,
			level: 'owner-only' as const,
			resourceOwnershipCheck: async () => false,
		};
		const result = await routeAuthChecks(mockUser, emptyEnv, requirement, { agentId: 'agent-1' });
		expect(result.success).toBe(false);
		expect(result.response!.status).toBe(403);
	});

	it('returns success: false when params are missing for an ownership check', async () => {
		const requirement = {
			required: true,
			level: 'owner-only' as const,
			resourceOwnershipCheck: async () => true,
		};
		// No params passed — check cannot be executed
		const result = await routeAuthChecks(mockUser, emptyEnv, requirement);
		expect(result.success).toBe(false);
	});

	it('returns success: true for owner-only routes without an ownership check function', async () => {
		const requirement = {
			required: true,
			level: 'owner-only' as const,
		};
		const result = await routeAuthChecks(mockUser, emptyEnv, requirement, { agentId: 'agent-1' });
		expect(result.success).toBe(true);
	});
});
