import { useNavigate } from 'react-router';
import { useCallback, useEffect } from 'react';
import { LoginModal } from '@/components/auth/login-modal';
import { useAuth } from '@/contexts/auth-context';

/**
 * Dedicated login page so `<landi-header login-url="/login">` opens the same flow as the app Sign In button.
 */
export default function LoginPage() {
	const navigate = useNavigate();
	const {
		isAuthenticated,
		login,
		loginWithEmail,
		register,
		error,
		clearError,
		getIntendedUrl,
		clearIntendedUrl,
	} = useAuth();

	useEffect(() => {
		if (!isAuthenticated) {
			return;
		}
		const next = getIntendedUrl();
		clearIntendedUrl();
		navigate(next || '/', { replace: true });
	}, [isAuthenticated, navigate, getIntendedUrl, clearIntendedUrl]);

	const handleClose = useCallback(() => {
		navigate('/', { replace: true });
	}, [navigate]);

	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center p-6">
			<p className="mb-6 max-w-md text-center text-sm text-text-secondary">
				Sign in to LANDiBUILD with Google, GitHub, or email.
			</p>
			<LoginModal
				isOpen
				onClose={handleClose}
				onLogin={(provider) => {
					void login(provider, '/');
				}}
				onEmailLogin={async (credentials) => {
					await loginWithEmail(credentials);
				}}
				onOAuthLogin={(provider) => {
					void login(provider, '/');
				}}
				onRegister={async (data) => {
					await register(data);
				}}
				error={error}
				onClearError={clearError}
				showCloseButton
			/>
		</div>
	);
}
