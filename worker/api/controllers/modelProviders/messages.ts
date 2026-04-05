/**
 * Single source of truth for user-facing copy when custom OpenAI-compatible provider CRUD is gated off.
 */

export const CUSTOM_PROVIDER_CRUD_DISABLED_MESSAGE =
	'Saving custom OpenAI-compatible endpoints in Landi Build is turned off for now. Use BYOK in the vault for supported providers, or use “Test connection” with a URL and API key to verify a third-party endpoint (diagnostics only).';

export const CUSTOM_PROVIDER_TEST_STORED_DISABLED_MESSAGE =
	'Testing a saved custom provider is unavailable while saved providers are disabled. Use “Test connection” with a base URL and API key instead.';

export const CUSTOM_PROVIDER_DELETE_DISABLED_MESSAGE =
	'Removing saved custom providers is unavailable while that feature is off.';
