/**
 * Complete Registration Page
 *
 * After Firebase authentication, user must provide organization name
 * to complete registration and create tenant.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks";
import { completeRegistration } from "../hooks/useApi";
import { trackSignUp } from "../lib/mixpanel";
import { resolveApiUrl } from "../lib/api";
import feneroLogo from "../assets/logo-orange.svg";

// Import background images
import bgSmallWebp from "../assets/login-page/optimized_background_small.webp";
import bgMediumWebp from "../assets/login-page/optimized_background_medium.webp";
import bgLargeWebp from "../assets/login-page/optimized_background_large.webp";
import bgSmallJpg from "../assets/login-page/optimized_background_small.jpg";
import bgMediumJpg from "../assets/login-page/optimized_background_medium.jpg";
import bgLargeJpg from "../assets/login-page/optimized_background_large.jpg";

// Responsive background component with optimized images
const BgPicture: React.FC = () => (
	<div className="absolute inset-0">
		<picture className="block h-full w-full">
			{/* WebP first */}
			<source
				type="image/webp"
				srcSet={`${bgSmallWebp} 500w, ${bgMediumWebp} 1000w, ${bgLargeWebp} 1920w`}
				sizes="(min-width: 1024px) 50vw, 100vw"
			/>
			{/* JPG fallback */}
			<img
				src={bgLargeJpg}
				srcSet={`${bgSmallJpg} 500w, ${bgMediumJpg} 1000w, ${bgLargeJpg} 1920w`}
				sizes="(min-width: 1024px) 50vw, 100vw"
				alt="Resort balcony overlooking lawn and palm trees"
				loading="lazy"
				decoding="async"
				className="h-full w-full object-cover"
				onError={(e) => {
					console.warn("Background image failed to load", (e.target as HTMLImageElement).src);
				}}
			/>
		</picture>
	</div>
);

export function CompleteRegistrationPage() {
	const [orgName, setOrgName] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [checkingTenant, setCheckingTenant] = useState(true);
	const { user, loading: authLoading } = useAuth();
	const navigate = useNavigate();

	// Check if user already has a tenant - if so, redirect to app
	useEffect(() => {
		async function checkExistingTenant() {
			if (authLoading) return;

			if (!user) {
				// Not logged in, redirect to login
				navigate("/login", { replace: true });
				return;
			}

			try {
				const token = await user.getIdToken();
				const response = await fetch(resolveApiUrl("/api/v1/auth/me"), {
					headers: { Authorization: `Bearer ${token}` },
				});

				if (response.ok) {
					const data = await response.json();
					if (data.has_tenant === true) {
						// User already has a tenant, redirect to app
						navigate("/app", { replace: true });
						return;
					}
				}
			} catch (err) {
				console.error("Failed to check tenant:", err);
			} finally {
				setCheckingTenant(false);
			}
		}

		checkExistingTenant();
	}, [user, authLoading, navigate]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!orgName.trim()) {
			setError("Organization name is required");
			return;
		}

		setLoading(true);

		try {
			// Call registration endpoint
			const response = await completeRegistration(orgName);

			console.log("Registration complete:", response);

			if (user) {
				trackSignUp({
					user_id: user.uid,
					email: user.email ?? undefined,
					signup_method: "email",
				});
			}

			// Refresh token to get new custom claims (tenant_id)
			if (response.requires_token_refresh && user) {
				console.log("Refreshing token to get custom claims...");
				await user.getIdToken(true); // Force refresh
				console.log("Token refreshed - custom claims now available");
			}

			// Redirect to app
			navigate("/app");
		} catch (err: any) {
			console.error("Registration failed:", err);

			// If user already belongs to an organization, redirect to app
			// Let TenantProtectedRoute admit the session if /auth/me false-negatives on has_tenant
			if (err.message?.includes("User already belongs")) {
				localStorage.setItem("bypass_tenant_check", "true");
				navigate("/app");
				return;
			}

			setError(err.message || "Registration failed. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	// Show loading while checking auth/tenant status
	if (authLoading || checkingTenant) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4" />
					<p className="text-gray-600">Loading...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex">
			{/* Background image - desktop only */}
			<div className="hidden lg:block lg:w-1/2 relative">
				<BgPicture />
				{/* Logo */}
				<div className="absolute top-8 left-8 flex items-center space-x-2 z-10">
					<img src={feneroLogo} alt="Fenero logo" className="h-8 brightness-0 invert" />
					<span className="text-white text-xl font-bold">Fenero</span>
				</div>
			</div>

			{/* Right side - Registration form */}
			<div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
				<div className="max-w-md w-full p-4 sm:p-8">
					{/* Mobile logo */}
					<div className="lg:hidden mb-8 flex items-center space-x-2">
						<img src={feneroLogo} alt="Fenero logo" className="h-8" />
						<span className="text-gray-900 text-xl font-bold">Fenero</span>
					</div>
					<div>
						<div className="bg-white p-8 border border-gray-200 rounded-lg shadow-sm">
							<h1 className="text-2xl font-bold text-gray-900 mb-2">Complete Your Registration</h1>
							<p className="text-gray-600 mb-8">
								Create your organization to start verifying income with AI-powered document
								analysis.
							</p>

							{error && (
								<div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
									{error}
								</div>
							)}

							<form onSubmit={handleSubmit}>
								<div className="mb-6">
									<label
										htmlFor="org-name"
										className="block text-sm font-medium text-gray-700 mb-2"
									>
										Organization Name
									</label>
									<input
										id="org-name"
										name="organization"
										type="text"
										required
										value={orgName}
										onChange={(e) => setOrgName(e.target.value)}
										className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
										placeholder="e.g., Acme Mortgage Group"
										disabled={loading}
									/>
								</div>

								<button
									type="submit"
									disabled={loading || !orgName.trim()}
									className="w-full bg-cta hover:bg-cta-hover text-white font-semibold py-4 px-4 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{loading ? (
										<span className="flex items-center justify-center">
											<svg
												className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
											>
												<circle
													className="opacity-25"
													cx="12"
													cy="12"
													r="10"
													stroke="currentColor"
													strokeWidth="4"
												></circle>
												<path
													className="opacity-75"
													fill="currentColor"
													d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
												></path>
											</svg>
											Creating Organization...
										</span>
									) : (
										"Create Organization"
									)}
								</button>

								<div className="mt-6 text-center">
									<p className="text-sm text-gray-500">
										Your organization name will be used to create a unique workspace.
									</p>
									<p className="text-sm text-gray-500 mt-1">
										You can invite team members after registration.
									</p>
								</div>
							</form>
						</div>
					</div>
				</div>
			</div>

			{/* Mobile background - shows on small screens */}
			<div className="lg:hidden fixed inset-0 -z-10">
				<BgPicture />
			</div>
		</div>
	);
}
