import { SessionProvider } from "@fenero/lux-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { PublicRoute } from "./components/PublicRoute";
import { TenantProtectedRoute } from "./components/TenantProtectedRoute";
import { RouteObserver } from "./components/analytics";
import LandingPage from "./components/landing/Landing";
import { Layout } from "./components/layout";
import { CaseHistoryProvider } from "./contexts/CaseHistoryContext";
import { HealthGate, HealthProvider } from "./contexts/HealthContext";
import { getFirebaseAuth } from "./lib/firebase";
import { CasePage, CompleteRegistrationPage, HomePage, LoginPage, SpecWorkshopPage } from "./pages";
import { queryClient } from "./queryClient";
import { store } from "./store";

/**
 * Routes: `/`, `/login`, `/complete-registration`; under layout: `/app`, `/case/:caseId/*`, `/spec-workshop`.
 * Case sub-routes (compare, compliance, scenarios, etc.) live in `pages/CasePage.tsx`. See README.md.
 */
export function App() {
	return (
		<HealthProvider>
			<HealthGate>
				<QueryClientProvider client={queryClient}>
					<Provider store={store}>
						<SessionProvider firebaseAuth={() => getFirebaseAuth()}>
							<BrowserRouter>
								<RouteObserver />
								<Routes>
									<Route
										path="/"
										element={
											<PublicRoute>
												<LandingPage />
											</PublicRoute>
										}
									/>
									<Route path="/login" element={<LoginPage />} />
									<Route path="/complete-registration" element={<CompleteRegistrationPage />} />
									<Route
										element={
											<TenantProtectedRoute>
												<CaseHistoryProvider>
													<Layout />
												</CaseHistoryProvider>
											</TenantProtectedRoute>
										}
									>
										<Route path="/app" element={<HomePage />} />
										<Route path="/case/:caseId/*" element={<CasePage />} />
										<Route path="/spec-workshop" element={<SpecWorkshopPage />} />
									</Route>
								</Routes>
							</BrowserRouter>
						</SessionProvider>
					</Provider>
				</QueryClientProvider>
			</HealthGate>
		</HealthProvider>
	);
}
