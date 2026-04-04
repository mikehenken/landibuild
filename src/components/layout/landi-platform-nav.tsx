import { useEffect, createElement } from 'react';
import '@landi/header';
import { useAuth } from '@/contexts/auth-context';
import { useLandiNavHidden } from '@/hooks/use-landi-nav-visibility';
import {
	isLandiPlatformNavEnabledFromEnv,
	LANDI_HEADER_LAYOUT_HEIGHT_PX,
} from '@/lib/landi-platform-nav-config';
import clsx from 'clsx';

/**
 * Landi platform chrome (`@landi/header` Lit web component) above the app shell.
 * Set `VITE_SHOW_LANDI_HEADER=false` to disable without removing the dependency.
 */
export function LandiPlatformNav() {
	const hidden = useLandiNavHidden();
	const { user, isAuthenticated, logout } = useAuth();

	useEffect(() => {
		const onSignOut = (): void => {
			void logout();
		};
		window.addEventListener('landi-header-sign-out', onSignOut);
		return () => window.removeEventListener('landi-header-sign-out', onSignOut);
	}, [logout]);

	if (!isLandiPlatformNavEnabledFromEnv()) {
		return null;
	}

	const reduceMotion =
		typeof window !== 'undefined' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	return (
		<div
			className={clsx(
				'shrink-0 w-full border-b border-border-primary/30 bg-bg-3',
				hidden && 'pointer-events-none min-h-0',
				!hidden && 'min-h-16',
			)}
			style={{
				minHeight: hidden ? 0 : LANDI_HEADER_LAYOUT_HEIGHT_PX,
				maxHeight: hidden ? 0 : undefined,
				overflow: hidden ? 'hidden' : 'visible',
				opacity: hidden ? 0 : 1,
				transition: reduceMotion
					? undefined
					: 'opacity 0.2s ease, max-height 0.25s ease, min-height 0.25s ease',
			}}
			aria-hidden={hidden}
		>
			{createElement('landi-header', {
				'brand-name': 'LANDiBUILD',
				'brand-logo': '/logobuild.png',
				'logo-href': '/',
				'login-url': '/login',
				'account-href': '/settings',
				'logged-in': isAuthenticated,
				'user-name': user?.displayName ?? user?.email ?? '',
				'user-avatar': user?.avatarUrl ?? '',
			})}
		</div>
	);
}
