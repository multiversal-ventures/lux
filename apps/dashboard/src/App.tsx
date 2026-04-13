import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicRoute } from "./components/PublicRoute";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";

export function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
				<Route path="/login" element={<LoginPage />} />
				<Route path="/app" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
			</Routes>
		</BrowserRouter>
	);
}
