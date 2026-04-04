import { describe, it, expect } from 'vitest';
import { AuthController } from './controller';

function makeEnv(overrides: Partial<Env> = {}): Env {
	return overrides as Env;
}

describe('AuthController.isSupabaseAuthEnabled', () => {
	it('returns false when USE_SUPABASE_AUTH is not set', () => {
		expect(AuthController.isSupabaseAuthEnabled(makeEnv({}))).toBe(false);
	});

	it('returns false when flag is "true" but SUPABASE_JWT_SECRET is missing', () => {
		expect(
			AuthController.isSupabaseAuthEnabled(
				makeEnv({ USE_SUPABASE_AUTH: 'true', SUPABASE_URL: 'https://example.supabase.co' }),
			),
		).toBe(false);
	});

	it('returns false when flag is "true" but SUPABASE_URL is missing', () => {
		expect(
			AuthController.isSupabaseAuthEnabled(
				makeEnv({ USE_SUPABASE_AUTH: 'true', SUPABASE_JWT_SECRET: 'some-secret' }),
			),
		).toBe(false);
	});

	it('returns true when flag is "true" and all required secrets are present', () => {
		expect(
			AuthController.isSupabaseAuthEnabled(
				makeEnv({
					USE_SUPABASE_AUTH: 'true',
					SUPABASE_JWT_SECRET: 'jwt-secret',
					SUPABASE_URL: 'https://example.supabase.co',
				}),
			),
		).toBe(true);
	});

	it('returns true when flag is "1" and all required secrets are present', () => {
		expect(
			AuthController.isSupabaseAuthEnabled(
				makeEnv({
					USE_SUPABASE_AUTH: '1',
					SUPABASE_JWT_SECRET: 'jwt-secret',
					SUPABASE_URL: 'https://example.supabase.co',
				}),
			),
		).toBe(true);
	});

	it('returns false when flag is any other truthy string (e.g. "yes")', () => {
		expect(
			AuthController.isSupabaseAuthEnabled(
				makeEnv({
					USE_SUPABASE_AUTH: 'yes',
					SUPABASE_JWT_SECRET: 'jwt-secret',
					SUPABASE_URL: 'https://example.supabase.co',
				}),
			),
		).toBe(false);
	});
});

describe('AuthController.hasOAuthProviders', () => {
	it('returns false when no providers are configured', () => {
		expect(AuthController.hasOAuthProviders(makeEnv({}))).toBe(false);
	});

	it('returns true when Google OAuth credentials are present', () => {
		expect(
			AuthController.hasOAuthProviders(
				makeEnv({ GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret' }),
			),
		).toBe(true);
	});

	it('returns true when GitHub OAuth credentials are present', () => {
		expect(
			AuthController.hasOAuthProviders(
				makeEnv({ GITHUB_CLIENT_ID: 'ghid', GITHUB_CLIENT_SECRET: 'ghsecret' }),
			),
		).toBe(true);
	});

	it('returns true when Supabase auth is enabled', () => {
		expect(
			AuthController.hasOAuthProviders(
				makeEnv({
					USE_SUPABASE_AUTH: 'true',
					SUPABASE_JWT_SECRET: 'jwt-secret',
					SUPABASE_URL: 'https://example.supabase.co',
				}),
			),
		).toBe(true);
	});

	it('returns false when only one credential of an OAuth pair is set', () => {
		expect(
			AuthController.hasOAuthProviders(makeEnv({ GOOGLE_CLIENT_ID: 'gid' })),
		).toBe(false);
	});
});
