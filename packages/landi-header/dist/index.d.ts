/**
 * Vendored Lit web component; runtime is the bundled `index.js`.
 * @see https://github.com/mikehenken/landi-ui/tree/main/packages/header
 */
export declare class LandiHeader extends HTMLElement {
	brandName: string;
	brandLogo: string;
	logoHref: string;
	userName: string;
	userAvatar: string;
	loginUrl: string;
	accountHref: string;
	loggedIn: boolean;
	supabaseUrl: string;
	supabaseKey: string;
}

declare global {
	interface HTMLElementTagNameMap {
		'landi-header': LandiHeader;
	}
}
