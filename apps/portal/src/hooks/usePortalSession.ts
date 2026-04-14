import { useState, useEffect } from "react";
import type { PortalSession, Intent } from "@fenero/lux-core";

/** Discriminated error type so callers can route on code without matching magic strings. */
export type PortalErrorCode = "expired" | "no_token" | "network" | "server" | "not_ready";

export interface PortalError {
	code: PortalErrorCode;
	message: string;
}

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

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const t = params.get("token");
		setToken(t);

		if (!t) {
			setError({ code: "no_token", message: "No portal token provided" });
			setLoading(false);
			return;
		}

		fetchSession(t);
	}, []);

	async function fetchSession(t: string) {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch("/api/portal/session", {
				headers: { "X-Portal-Token": t },
			});
			if (!res.ok) {
				if (res.status === 401) {
					setError({ code: "expired", message: "Session has expired. Please request a new link." });
				} else {
					setError({ code: "server", message: `Failed to load session (${res.status})` });
				}
				return;
			}
			const data: PortalSession = await res.json();
			setSession(data);
		} catch {
			setError({ code: "network", message: "Failed to connect to server" });
		} finally {
			setLoading(false);
		}
	}

	async function submitIntent(intents: Intent[]) {
		if (!session || !token) {
			setError({ code: "not_ready", message: "Session not ready" });
			return;
		}

		try {
			const res = await fetch(`/api/portal/session/${session.session_id}/intents`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Portal-Token": token,
				},
				body: JSON.stringify({ intents }),
			});
			if (res.ok) {
				const data: { session: PortalSession } = await res.json();
				setSession(data.session);
			} else {
				setError({ code: "server", message: `Failed to submit (${res.status})` });
			}
		} catch {
			setError({ code: "network", message: "Failed to submit" });
		}
	}

	return { session, loading, error, submitIntent };
}
