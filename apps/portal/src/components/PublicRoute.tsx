import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface PublicRouteProps {
	children: ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
	const { user, loading } = useAuth();

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-50">
				<div className="spinner" />
			</div>
		);
	}

	if (user) {
		return <Navigate to="/app" replace />;
	}

	return <>{children}</>;
}
