import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";
import { QueryClientProvider } from "@tanstack/react-query";
import LandingPage from "./components/landing/Landing";
import { RouteObserver } from "./components/analytics";
import { Layout } from "./components/layout";
import { CaseHistoryProvider } from "./contexts/CaseHistoryContext";
import { HealthGate, HealthProvider } from "./contexts/HealthContext";
import { PublicRoute } from "./components/PublicRoute";
import { TenantProtectedRoute } from "./components/TenantProtectedRoute";
import { CasePage, CompleteRegistrationPage, HomePage, LoginPage, SpecWorkshopPage } from "./pages";
import { store } from "./store";
import { queryClient } from "./queryClient";

export function App() {
	return (
		<HealthProvider>
			<HealthGate>
				<QueryClientProvider client={queryClient}>
					<Provider store={store}>
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
					</Provider>
				</QueryClientProvider>
			</HealthGate>
		</HealthProvider>
	);
}
