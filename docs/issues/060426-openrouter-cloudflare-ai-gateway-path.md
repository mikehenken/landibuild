# OpenRouter + Cloudflare AI Gateway base URL (06 Apr 2026)

## Symptom

Inference failed with HTTP 400 from AI Gateway, error code `2019`, message similar to: `Compatibility endpoint: openrouter/chat/completions is not supported.`

Logs showed `baseUrl` ending in `/compat/openrouter` (or equivalent) while the OpenAI SDK appended `/chat/completions`.

## Root cause

OpenRouter on Cloudflare AI Gateway uses the **provider-native** path segment (`.../v1/{account_id}/{gateway_id}/openrouter`), not the generic compat segment (`.../compat/openrouter`). Routing OpenRouter under `/compat` yields the unsupported compatibility route.

## Fix

In `worker/agents/inferutils/core.ts`, `buildGatewayPathname` / `buildGatewayUrl`:

- For `providerOverride === 'openrouter'`, normalize to `${gatewayRoot}/openrouter` (strip stray `/compat` or trailing `/openrouter` duplicates from pasted roots).
- Other providers continue to use `${gatewayRoot}/compat/...` as before.

## Reference

[OpenRouter provider – Cloudflare AI Gateway docs](https://developers.cloudflare.com/ai-gateway/usage/providers/openrouter/)

## Verification

Logs should show `baseUrl` ending in `.../openrouter` (no `/compat/openrouter` for OpenRouter). Chat completions should return 200 when keys and gateway token are valid.
