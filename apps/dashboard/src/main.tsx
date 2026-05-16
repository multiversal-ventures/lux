import { initLux } from "@multiversal-ventures/lux-core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

/**
 * Sample-only auth provider. Returns a hardcoded dev token so the sample
 * stays runnable with no backend or identity provider.
 *
 * Real apps should plug in any `AuthProvider` implementation (IdP tokens,
 * portal token, etc.) here.
 */
const sampleAuth = {
	async getToken(): Promise<string | null> {
		return "dev-sample-token";
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

const rootEl = document.getElementById("root");
if (!rootEl) {
	throw new Error("Missing #root element");
}
createRoot(rootEl).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
