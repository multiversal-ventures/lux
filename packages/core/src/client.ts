import type { components } from "./generated.js";

type PortalSession = components["schemas"]["PortalSessionResponse"];
type Intent = components["schemas"]["Intent"];

/** HTTP header name used to authenticate portal API requests. */
const PORTAL_AUTH_HEADER = "X-Portal-Token" as const;

export interface PortalClientConfig {
	/** Base URL of the Veritas API (e.g. "" for same-origin, "https://api.example.com" for external). */
	baseUrl?: string;
}

export interface PortalClientError {
	code: "expired" | "no_token" | "network" | "server" | "not_ready";
	message: string;
	status?: number;
}

/** Discriminated union: exactly one of session or error is set. */
export type FetchSessionResult =
	| { session: PortalSession; error: null }
	| { session: null; error: PortalClientError };

/** Discriminated union: exactly one of session or error is set. */
export type SubmitIntentsResult =
	| { session: PortalSession; error: null }
	| { session: null; error: PortalClientError };

/**
 * Minimal portal session client.
 *
 * Wraps the two portal endpoints (/portal/session and /portal/session/{id}/intents)
 * with typed results so app code doesn't need to hand-roll fetch logic.
 */
export function createPortalClient(config: PortalClientConfig = {}) {
	const base = config.baseUrl ?? "";

	async function fetchSession(token: string): Promise<FetchSessionResult> {
		try {
			const res = await fetch(`${base}/api/portal/session`, {
				headers: { [PORTAL_AUTH_HEADER]: token },
			});
			if (!res.ok) {
				if (res.status === 401) {
					return { session: null, error: { code: "expired", message: "Session has expired. Please request a new link.", status: 401 } };
				}
				return { session: null, error: { code: "server", message: `Failed to load session (${res.status})`, status: res.status } };
			}
			const session: PortalSession = await res.json();
			return { session, error: null };
		} catch {
			return { session: null, error: { code: "network", message: "Failed to connect to server" } };
		}
	}

	async function submitIntents(
		sessionId: string,
		token: string,
		intents: Intent[],
	): Promise<SubmitIntentsResult> {
		try {
			const res = await fetch(`${base}/api/portal/session/${sessionId}/intents`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					[PORTAL_AUTH_HEADER]: token,
				},
				body: JSON.stringify({ intents }),
			});
			if (!res.ok) {
				return { session: null, error: { code: "server", message: `Failed to submit (${res.status})`, status: res.status } };
			}
			const data: { session: PortalSession } = await res.json();
			return { session: data.session, error: null };
		} catch {
			return { session: null, error: { code: "network", message: "Failed to submit" } };
		}
	}

	return { fetchSession, submitIntents };
}
