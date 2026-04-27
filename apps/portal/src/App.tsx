import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SessionPage } from "./pages/SessionPage";
import { ExpiredPage } from "./pages/ExpiredPage";

/**
 * Portal app — borrower-facing, token-authenticated.
 *
 * Entry: /?token=<portal_token_hex>
 * The token is in the URL (from SMS/email link). No login page.
 * Token validates → session loads → borrower sees checklist.
 * Token invalid/expired → expired page.
 */
export function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<SessionPage />} />
				<Route path="/expired" element={<ExpiredPage />} />
			</Routes>
		</BrowserRouter>
	);
}
