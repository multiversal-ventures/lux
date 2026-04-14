import { useState, useEffect, useMemo } from "react";
import type { PortalSession, Intent, PortalClientError } from "@fenero/lux-core";
import { createPortalClient } from "@fenero/lux-core";

/** Portal error type — re-exported from @fenero/lux-core for convenience. */
export type PortalError = PortalClientError;

interface UsePortalSessionReturn {
	session: PortalSession | null;
	loading: boolean;
	error: PortalError | null;
	submitIntent: (intents: Intent[]) => Promise<void>;
}

export function usePortalSession(): UsePortalSessionReturn {
	const [session, setSession] = useState<PortalSession | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<PortalError | null>(null);
	const [token, setToken] = useState<string | null>(null);

	const client = useMemo(() => createPortalClient(), []);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const t = params.get("token");
		setToken(t);

		if (!t) {
			setError({ code: "no_token", message: "No portal token provided" });
			setLoading(false);
			return;
		}

		loadSession(t);
	}, []);

	async function loadSession(t: string) {
		setLoading(true);
		setError(null);
		const result = await client.fetchSession(t);
		if (result.error) {
			setError(result.error);
		} else {
			setSession(result.session);
		}
		setLoading(false);
	}

	async function submitIntent(intents: Intent[]) {
		if (!session || !token) {
			setError({ code: "not_ready", message: "Session not ready" });
			return;
		}

		const result = await client.submitIntents(session.session_id, token, intents);
		if (result.error) {
			setError(result.error);
		} else if (result.session) {
			setSession(result.session);
		}
	}

	return { session, loading, error, submitIntent };
}
