import { useLandiNavHidden } from '@/hooks/use-landi-nav-visibility';
import { isLandiPlatformNavEnabledFromEnv } from '@/lib/landi-platform-nav-config';

/**
 * True when the fixed landi-header strip is shown (enabled in env and not hidden by route).
 */
export function useLandiPlatformNavChromeVisible(): boolean {
	const hidden = useLandiNavHidden();
	if (!isLandiPlatformNavEnabledFromEnv()) {
		return false;
	}
	return !hidden;
}
