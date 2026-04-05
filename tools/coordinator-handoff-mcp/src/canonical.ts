/**
 * Stable JSON serialization: sorted object keys, deterministic arrays.
 * Not full RFC 8785; sufficient for identical fingerprints across runtimes for our schema.
 */
export function canonicalizeJson(value: unknown): string {
	if (value === null || typeof value !== 'object') {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map((item) => canonicalizeJson(item)).join(',')}]`;
	}
	const obj = value as Record<string, unknown>;
	const keys = Object.keys(obj).sort();
	const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`);
	return `{${pairs.join(',')}}`;
}
