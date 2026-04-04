import { AIModels, isChatCompletionAIModel } from '../../../agents/inferutils/config.types';
import type { UserProviderStatus, ModelsByProvider } from './types';
import { getBYOKTemplates } from '../../../types/secretsTemplates';
import type { UserSecretsStoreStub } from '../../../services/secrets/SecretsClient';

function looksLikeApiKey(value: string): boolean {
	const v = value.trim();
	return (
		v.length >= 10 &&
		v.toLowerCase() !== 'none' &&
		v.toLowerCase() !== 'default'
	);
}

function isValidPlatformApiKey(apiKey: string | undefined): boolean {
	return !!(
		apiKey &&
		apiKey.trim() !== '' &&
		apiKey.trim().toLowerCase() !== 'default' &&
		apiKey.trim().toLowerCase() !== 'none' &&
		apiKey.trim().length >= 10
	);
}

/**
 * Decrypted BYOK provider keys from the user's vault (when unlocked on the DO).
 * Used so model tests and inference can use the same keys as the agent after unlock.
 */
export async function loadByokKeysFromUserVault(
	env: Env,
	userId: string,
): Promise<Record<string, string>> {
	const keys: Record<string, string> = {};
	const ns = env.UserSecretsStore;
	if (!ns) {
		return keys;
	}

	try {
		const stub = ns.get(ns.idFromName(userId)) as unknown as UserSecretsStoreStub;
		const templates = getBYOKTemplates();
		for (const template of templates) {
			const result = await stub.requestSecret({
				provider: template.provider,
				envVarName: template.envVarName,
			});
			if (result.success && result.value && looksLikeApiKey(result.value)) {
				keys[template.provider] = result.value.trim();
			}
		}
	} catch (error) {
		console.error('loadByokKeysFromUserVault: vault read failed:', error);
		return keys;
	}

	return keys;
}

export async function getUserProviderStatus(
	userId: string,
	env: Env,
): Promise<UserProviderStatus[]> {
	const templates = getBYOKTemplates();
	const ns = env.UserSecretsStore;

	if (!ns) {
		return templates.map((template) => ({
			provider: template.provider,
			hasValidKey: false,
		}));
	}

	let stub: UserSecretsStoreStub;
	try {
		stub = ns.get(ns.idFromName(userId)) as unknown as UserSecretsStoreStub;
	} catch (error) {
		console.error('getUserProviderStatus: failed to resolve UserSecretsStore stub:', error);
		return templates.map((template) => ({
			provider: template.provider,
			hasValidKey: false,
		}));
	}

	const results: UserProviderStatus[] = [];
	for (const template of templates) {
		let hasValidKey = false;
		try {
			const secretResult = await stub.requestSecret({
				provider: template.provider,
				envVarName: template.envVarName,
			});
			if (
				secretResult.success &&
				secretResult.value &&
				looksLikeApiKey(secretResult.value)
			) {
				hasValidKey = true;
			}
		} catch (error) {
			console.error(
				`getUserProviderStatus: requestSecret failed for provider ${template.provider}:`,
				error,
			);
		}
		results.push({ provider: template.provider, hasValidKey });
	}

	return results;
}

export function getByokModels(
	providerStatuses: UserProviderStatus[],
): ModelsByProvider {
	const modelsByProvider: ModelsByProvider = {};

	providerStatuses
		.filter((status) => status.hasValidKey)
		.forEach((status) => {
			const providerModels = Object.values(AIModels).filter(
				(model) =>
					isChatCompletionAIModel(model) &&
					getAccessProviderFromModelId(model) === status.provider,
			);

			if (providerModels.length > 0) {
				modelsByProvider[status.provider] = providerModels;
			}
		});

	return modelsByProvider;
}

export function getPlatformEnabledProviders(env: Env): string[] {
	const configured = env.PLATFORM_MODEL_PROVIDERS
		? env.PLATFORM_MODEL_PROVIDERS.split(',').map((p) => p.trim()).filter(Boolean)
		: null;

	const autoDetected: string[] = [];
	const providerList = [
		'anthropic',
		'openai',
		'google-ai-studio',
		'workers',
		'cerebras',
		'groq',
	] as const;

	for (const provider of providerList) {
		const providerKeyString = provider.toUpperCase().replaceAll('-', '_');
		const envKey = `${providerKeyString}_API_KEY` as keyof Env;
		const apiKey = env[envKey] as string;
		if (isValidPlatformApiKey(apiKey)) {
			autoDetected.push(provider);
		}
	}

	if (isValidPlatformApiKey(env.WORKERS_API_KEY)) {
		autoDetected.push('workers');
	}

	if (configured) {
		const merged = new Set(configured);
		if (isValidPlatformApiKey(env.WORKERS_API_KEY)) {
			merged.add('workers');
		}
		return [...merged];
	}

	return autoDetected;
}

export function getPlatformAvailableModels(env: Env): AIModels[] {
	const platformEnabledProviders = getPlatformEnabledProviders(env);

	return Object.values(AIModels).filter((model) => {
		if (!isChatCompletionAIModel(model)) {
			return false;
		}
		const accessProvider = getAccessProviderFromModelId(model);
		return platformEnabledProviders.includes(accessProvider);
	});
}

export function validateModelAccessForEnvironment(
	model: AIModels | string,
	env: Env,
	userProviderStatus: UserProviderStatus[],
): boolean {
	// DISABLED is a sentinel meaning "feature turned off" — always allow saving it
	// so users can deactivate a feature without a provider key error.
	if (model === AIModels.DISABLED) {
		return true;
	}

	const accessProvider = getAccessProviderFromModelId(model);

	const hasPlatformKey = getPlatformEnabledProviders(env).includes(accessProvider);
	const hasUserKey = userProviderStatus.some(
		(status) => status.provider === accessProvider && status.hasValidKey,
	);

	return hasPlatformKey || hasUserKey;
}

/**
 * First path segment of the model id (e.g. `openai` from `openai/gpt-4`), or `cloudflare` when there is no slash.
 * This is the raw gateway/model-registry prefix, not necessarily the same as {@link getAccessProviderFromModelId}.
 */
export function getProviderFromModel(model: AIModels | string): string {
	if (typeof model === 'string' && model.includes('/')) {
		return model.split('/')[0];
	}
	return 'cloudflare';
}

/**
 * Provider id used for platform env keys, BYOK vault provider field, and enabled-provider membership.
 * Maps `workers-ai/...` model ids to `workers` so they align with `WORKERS_API_KEY` and BYOK template `provider: workers`.
 */
export function getAccessProviderFromModelId(model: AIModels | string): string {
	const raw = getProviderFromModel(model);
	if (raw === 'workers-ai') {
		return 'workers';
	}
	return raw;
}
