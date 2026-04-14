import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TenantProtectedRoute } from "./components/TenantProtectedRoute";
import { PublicRoute } from "./components/PublicRoute";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";

export function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
				<Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
				<Route path="/app" element={<TenantProtectedRoute><HomePage /></TenantProtectedRoute>} />
			</Routes>
		</BrowserRouter>
	);
}
