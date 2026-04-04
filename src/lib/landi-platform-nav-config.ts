/**
 * Whether the landi-ui platform strip is enabled via Vite env (default: on unless explicitly false).
 */
export function isLandiPlatformNavEnabledFromEnv(): boolean {
	const v = import.meta.env.VITE_SHOW_LANDI_HEADER;
	return (
		v === 'true' ||
		v === '1' ||
		(v !== 'false' && v !== '0')
	);
}

/** Lit landi-header :host height in landi-ui (packages/header styles). */
export const LANDI_HEADER_LAYOUT_HEIGHT_PX = 64;
