/**
 * Feature flags and admin gating for custom OpenAI-compatible providers (HTTP CRUD).
 */

type EnvWithProviderFlags = Env & {
	ENABLE_CUSTOM_MODEL_PROVIDER_CRUD?: string;
	PLATFORM_ADMIN_USER_IDS?: string;
};

export function isCustomModelProviderCrudEnabled(env: Env): boolean {
	return (env as EnvWithProviderFlags).ENABLE_CUSTOM_MODEL_PROVIDER_CRUD === 'true';
}

/** Comma-separated user IDs. Empty means any authenticated user may manage their own providers once CRUD is enabled. */
export function getPlatformAdminUserIdSet(env: Env): Set<string> {
	const raw = (env as EnvWithProviderFlags).PLATFORM_ADMIN_USER_IDS?.trim();
	if (!raw) return new Set();
	return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

export function userMayManageCustomProviders(env: Env, userId: string): boolean {
	const admins = getPlatformAdminUserIdSet(env);
	if (admins.size === 0) return true;
	return admins.has(userId);
}
