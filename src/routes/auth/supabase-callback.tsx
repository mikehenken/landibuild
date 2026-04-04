import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/contexts/auth-context';
import { apiClient } from '@/lib/api-client';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser-client';
import { INTENDED_URL_KEY } from '@/lib/auth-storage-keys';

/**
 * OAuth return URL for Supabase Auth (`signInWithOAuth`). Bridges Supabase access token to Worker cookies.
 */
export default function SupabaseAuthCallback() {
	const navigate = useNavigate();
	const { refreshUser } = useAuth();
	const [message, setMessage] = useState<string>('Signing you in…');
	const [isError, setIsError] = useState(false);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			const supabase = getSupabaseBrowserClient();
			if (!supabase) {
				setIsError(true);
				setMessage('Supabase client is not configured.');
				return;
			}

			const { data, error: sessionError } = await supabase.auth.getSession();
			const accessToken = data.session?.access_token;

			if (sessionError || !accessToken) {
				setIsError(true);
				setMessage(
					sessionError?.message ??
						'No Supabase session. Check redirect URL allowlist in Supabase.',
				);
				return;
			}

			try {
				const bridge = await apiClient.bridgeSupabaseSession(accessToken);
				if (!bridge.success || !bridge.data) {
					throw new Error(bridge.error?.message ?? 'Session bridge failed');
				}
				await supabase.auth.signOut();
				if (cancelled) {
					return;
				}
				await refreshUser();
				let intended: string | null = null;
				try {
					intended = sessionStorage.getItem(INTENDED_URL_KEY);
					sessionStorage.removeItem(INTENDED_URL_KEY);
				} catch {
					intended = null;
				}
				navigate(intended || '/', { replace: true });
			} catch (e) {
				if (!cancelled) {
					setIsError(true);
					setMessage(e instanceof Error ? e.message : 'Authentication failed');
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [navigate, refreshUser]);

	return (
		<div
			className={
				isError
					? 'flex min-h-[40vh] items-center justify-center p-8 text-center text-red-600'
					: 'flex min-h-[40vh] items-center justify-center p-8 text-center text-text-secondary'
			}
		>
			{message}
		</div>
	);
}
