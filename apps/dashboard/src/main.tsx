import { initLux } from "@fenero/lux-core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

/**
 * Sample-only auth provider. Returns a hardcoded dev token so the sample
 * stays runnable with no backend / Firebase setup.
 *
 * Real apps should plug in `createFirebaseAuthProvider` (or any other
 * `AuthProvider` implementation) here.
 */
const sampleAuth = {
	async getToken(): Promise<string | null> {
		return "dev-sample-token";
	},
	async getUserId(): Promise<string | null> {
		return "dev-sample-user";
	},
};

initLux({
	baseUrl: import.meta.env.VITE_LUX_BASE_URL ?? "",
	auth: sampleAuth,
	hooks: {
		onApiError: (info) => {
			console.warn("[lux-sample] API error", info);
		},
	},
});

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
