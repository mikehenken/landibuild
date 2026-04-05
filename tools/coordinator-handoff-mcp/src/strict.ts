export function isStrictMode(): boolean {
	const v = process.env.COORDINATOR_HANDOFF_STRICT?.trim().toLowerCase();
	return v === '1' || v === 'true' || v === 'yes';
}

export function requireChainTip(): boolean {
	if (isStrictMode()) {
		return true;
	}
	const v = process.env.COORDINATOR_HANDOFF_REQUIRE_CHAIN_TIP?.trim().toLowerCase();
	return v === '1' || v === 'true' || v === 'yes';
}

export function workspaceRootFromEnv(): string | undefined {
	const raw = process.env.COORDINATOR_HANDOFF_WORKSPACE_ROOT?.trim();
	return raw && raw.length > 0 ? raw : undefined;
}
