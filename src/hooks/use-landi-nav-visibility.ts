import { useLocation } from 'react-router';

/**
 * Hides the landi-ui platform strip on full-bleed builder routes (chat + app editor).
 */
export function useLandiNavHidden(): boolean {
	const { pathname } = useLocation();

	if (pathname.startsWith('/chat/')) {
		return true;
	}

	if (/^\/app\/[^/]+/.test(pathname)) {
		return true;
	}

	return false;
}
