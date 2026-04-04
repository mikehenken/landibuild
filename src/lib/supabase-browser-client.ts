import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function isSupabaseBrowserAuthEnabled(): boolean {
	const flag = import.meta.env.VITE_USE_SUPABASE_AUTH;
	const on = flag === 'true' || flag === '1';
	const url = import.meta.env.VITE_SUPABASE_URL?.trim();
	const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
	return on && !!url && !!key;
}

/** Browser Supabase client for OAuth; Worker cookies become the session after `apiClient.bridgeSupabaseSession`. */
export function getSupabaseBrowserClient(): SupabaseClient | null {
	if (!isSupabaseBrowserAuthEnabled()) {
		return null;
	}
	if (!cached) {
		const url = import.meta.env.VITE_SUPABASE_URL!.trim();
		const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!.trim();
		cached = createClient(url, anonKey, {
			auth: {
				flowType: 'pkce',
				detectSessionInUrl: true,
				persistSession: true,
				autoRefreshToken: true,
			},
		});
	}
	return cached;
}
