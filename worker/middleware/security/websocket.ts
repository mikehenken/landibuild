import { isOriginAllowed } from '../../config/security';
import { createLogger } from '../../logger';

const logger = createLogger('WebSocketSecurity');

/**
 * Allow browser WebSockets from http://localhost / http://127.0.0.1 when the
 * upgrade request is also directed at localhost. Local dev often omits
 * `ENVIRONMENT` in `.dev.vars`; without it, `isDev(env)` is false and
 * `getAllowedOrigins()` excludes localhost, which rejects every dev WebSocket
 * with 403 before the handshake completes.
 *
 * Production traffic uses a real hostname on the request URL, so this path
 * does not relax origin checks for deployed workers.
 */
const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function isBrowserLocalDevWebSocket(request: Request, origin: string): boolean {
	const url = new URL(request.url);
	const reqHost = url.hostname.toLowerCase();
	if (!LOCAL_DEV_HOSTS.has(reqHost)) {
		return false;
	}
	try {
		const originUrl = new URL(origin);
		if (originUrl.protocol !== 'http:') {
			return false;
		}
		const originHost = originUrl.hostname.toLowerCase();
		return LOCAL_DEV_HOSTS.has(originHost);
	} catch {
		return false;
	}
}

export function validateWebSocketOrigin(request: Request, env: Env): boolean {
	const origin = request.headers.get('Origin');

	if (!origin) {
		// Server-side SDK clients do not send `Origin`.
		// ownership and authorization is anyways checked in the middlewares already
		const authHeader = request.headers.get('Authorization');
		if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
			return true;
		}

		logger.warn('WebSocket connection attempt without Origin header');
		return false;
	}

	if (isBrowserLocalDevWebSocket(request, origin)) {
		return true;
	}

	if (!isOriginAllowed(env, origin)) {
		logger.warn('WebSocket connection rejected from unauthorized origin', { origin });
		return false;
	}

	return true;
}

export function getWebSocketSecurityHeaders(): Record<string, string> {
    return {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block'
    };
}
