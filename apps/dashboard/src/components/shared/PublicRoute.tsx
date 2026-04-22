import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks";

interface PublicRouteProps {
	children: ReactNode;
}

/**
 * Route wrapper for public (unauthenticated) pages.
 * Shows children for unauthenticated users.
 * Redirects to /app if user is already authenticated.
 */
export function PublicRoute({ children }: PublicRouteProps) {
	const { user, loading } = useAuth();

	// Show loading spinner while checking authentication
	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-50">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-4" />
					<p className="text-slate-600">Loading...</p>
				</div>
			</div>
		);
	}

	// Redirect authenticated users to the app
	if (user) {
		return <Navigate to="/app" replace />;
	}

	return <>{children}</>;
}
