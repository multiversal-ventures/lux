import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks";
import { useAppDispatch } from "../../store";
import { setTenantId, setTenantName } from "../../store/appSlice";

interface ProtectedRouteProps {
	children: ReactNode;
}

/**
 * Route wrapper that requires authentication and tenant registration.
 * Redirects to /login if user is not authenticated.
 * Redirects to /complete-registration if user has no tenant_id.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
	const { user, loading } = useAuth();
	const dispatch = useAppDispatch();
	const [hasTenant, setHasTenant] = useState<boolean | null>(null);
	const [checkingTenant, setCheckingTenant] = useState(true);
	// Check if user has tenant via /auth/me API
	useEffect(() => {
		async function checkTenantId() {
			if (!user) {
				setCheckingTenant(false);
				return;
			}

			try {
				// Call /auth/me to check tenant membership from TenantStore
				const token = await user.getIdToken();
				const response = await fetch("/api/v1/auth/me", {
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});

				if (response.ok) {
					const data = await response.json();

					if (data.has_tenant === true) {
						if (data.tenant_id && data.tenant_name) {
							dispatch(setTenantId(data.tenant_id));
							dispatch(setTenantName(data.tenant_name));
							setHasTenant(true);
						} else {
							// Fetch tenant details from /tenants/me
							try {
								const tenantResponse = await fetch("/api/v1/tenants/me", {
									headers: {
										Authorization: `Bearer ${token}`,
									},
								});
								if (tenantResponse.ok) {
									const tenantData = await tenantResponse.json();
									dispatch(setTenantId(tenantData.tenant_id));
									dispatch(setTenantName(tenantData.tenant_name));
								}
							} catch (err) {
								console.error("Failed to fetch tenant details:", err);
							}
							setHasTenant(true);
						}
					} else {
						const bypassCheck = localStorage.getItem("bypass_tenant_check");
						if (bypassCheck) {
							//FALSE NEGATIVE
							// Fetch tenant details via complete-registration (returns error with tenant info if user has tenant)
							const tenantResponse = await fetch("/api/v1/auth/complete-registration", {
								method: "POST",
								headers: {
									Authorization: `Bearer ${token}`,
									"Content-Type": "application/json",
								},
								body: JSON.stringify({ organization_name: "" }),
							});
							const tenantData = await tenantResponse.json();

							// Extract tenant name from error message: "User already belongs to tenant
							if (tenantData.detail) {
								const match = tenantData.detail.match(/tenant '([^']+)'/);
								if (match) {
									const tenantSlug = match[1];
									const tenantName = tenantSlug.replace(/-/g, " ");
									dispatch(setTenantName(tenantName));
									setHasTenant(true);
								}
							}
						} else {
							// MAYBE TRUE NEGATIVE
							setHasTenant(false);
						}
					}
				}
			} catch (error) {
				console.error("Failed to check tenant:", error);
				setHasTenant(false);
			} finally {
				setCheckingTenant(false);
			}
		}

		if (!loading) {
			checkTenantId();
		}
	}, [user, loading]);

	// Show loading spinner while checking authentication or tenant
	if (loading || checkingTenant) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-50">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-4" />
					<p className="text-slate-600">Loading...</p>
				</div>
			</div>
		);
	}

	// Redirect to login if not authenticated
	if (!user) {
		localStorage.removeItem("bypass_tenant_check");
		return <Navigate to="/login" replace />;
	}

	// Redirect to complete registration if no tenant_id
	// Skip if bypass flag is set (workaround for backend bug where user already belongs)
	if (hasTenant === false) {
		const bypassCheck = localStorage.getItem("bypass_tenant_check");
		if (!bypassCheck) {
			return <Navigate to="/complete-registration" replace />;
		}
	}

	return <>{children}</>;
}
