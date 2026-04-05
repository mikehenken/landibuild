/**
 * Validates user-supplied OpenAI-compatible API base URLs before Workers perform outbound fetch.
 * Blocks common SSRF targets: loopback, link-local, private ranges, cloud metadata hosts.
 */

const BLOCKED_HOSTNAMES = new Set(
	[
		'localhost',
		'metadata.google.internal',
		'metadata',
		'metadata.google',
	].map((h) => h.toLowerCase()),
);

function parseIPv4(host: string): [number, number, number, number] | null {
	const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
	if (!m) return null;
	const octets = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
	if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
	return [octets[0], octets[1], octets[2], octets[3]];
}

function isPrivateOrBlockedIPv4(octets: [number, number, number, number]): boolean {
	const [a, b] = octets;
	if (a === 0 || a === 127) return true;
	if (a === 10) return true;
	if (a === 169 && b === 254) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	if (a === 100 && b >= 64 && b <= 127) return true;
	if (a === 255 && b === 255 && octets[2] === 255 && octets[3] === 255) return true;
	return false;
}

function isBlockedHostname(hostname: string): boolean {
	const h = hostname.toLowerCase();
	if (BLOCKED_HOSTNAMES.has(h)) return true;
	if (h.endsWith('.local') || h.endsWith('.localhost')) return true;
	if (h.includes('metadata.google')) return true;

	const v4 = parseIPv4(h);
	if (v4) return isPrivateOrBlockedIPv4(v4);

	if (h.includes(':')) {
		const lower = h.replace(/^\[|\]$/g, '');
		if (lower === '::1') return true;
		if (lower.startsWith('fe80:')) return true;
		if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
		if (lower.startsWith('::ffff:')) {
			const v4part = lower.slice('::ffff:'.length);
			const parsed = parseIPv4(v4part);
			if (parsed) return isPrivateOrBlockedIPv4(parsed);
		}
	}

	return false;
}

export type ValidateBaseUrlResult =
	| { ok: true; normalizedBaseUrl: string }
	| { ok: false; reason: string };

/**
 * @param allowHttp - When true (e.g. local dev), http scheme is allowed; still blocks private/metadata targets.
 */
export function validateOpenAiCompatibleBaseUrl(
	rawUrl: string,
	options: { allowHttp?: boolean } = {},
): ValidateBaseUrlResult {
	let parsed: URL;
	try {
		parsed = new URL(rawUrl.trim());
	} catch {
		return { ok: false, reason: 'Invalid URL' };
	}

	if (parsed.username || parsed.password) {
		return { ok: false, reason: 'URL must not include credentials' };
	}

	if (parsed.protocol !== 'https:' && !(options.allowHttp && parsed.protocol === 'http:')) {
		return {
			ok: false,
			reason: options.allowHttp
				? 'Only https or http URLs are allowed'
				: 'Only https URLs are allowed in this environment',
		};
	}

	if (parsed.hash) {
		return { ok: false, reason: 'URL must not include a fragment' };
	}

	const hostname = parsed.hostname;
	if (!hostname) {
		return { ok: false, reason: 'Missing host' };
	}

	if (isBlockedHostname(hostname)) {
		return { ok: false, reason: 'Host is not allowed (private, loopback, or metadata endpoints blocked)' };
	}

	const path = parsed.pathname.replace(/\/$/, '') || '';
	const normalized = `${parsed.origin}${path === '' ? '' : path}`;

	return { ok: true, normalizedBaseUrl: normalized };
}
