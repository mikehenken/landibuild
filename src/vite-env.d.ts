/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
	readonly VITE_USE_SUPABASE_AUTH?: string;
	readonly VITE_SUPABASE_URL?: string;
	readonly VITE_SUPABASE_ANON_KEY?: string;
	/** Set to "false" or "0" to hide the landi-ui platform header strip. */
	readonly VITE_SHOW_LANDI_HEADER?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
