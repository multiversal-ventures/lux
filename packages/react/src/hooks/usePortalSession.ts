import { useCallback, useEffect, useMemo, useState } from "react";
import type { Intent, PortalClientError, PortalSession } from "@multiversal-ventures/lux-core";
import { createPortalClient } from "@multiversal-ventures/lux-core";

export interface UsePortalSessionReturn {
	session: PortalSession | null;
	loading: boolean;
	error: PortalClientError | null;
	submitIntent: (intents: Intent[]) => Promise<void>;
	/** Upload documents to the case, then refresh the session. Returns success. */
	uploadDocuments: (files: File[]) => Promise<boolean>;
}

/**
 * Manage the lifecycle of a portal session for a given token.
 *
 * @param token - Portal token string (from URL, storage, etc.), or null to
 *   produce an immediate "no_token" error. The caller owns token sourcing.
 */
export function usePortalSession(token: string | null): UsePortalSessionReturn {
	const [session, setSession] = useState<PortalSession | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<PortalClientError | null>(null);

	const client = useMemo(() => createPortalClient(), []);

	const loadSession = useCallback(
		async (t: string) => {
			setLoading(true);
			setError(null);
			const result = await client.fetchSession(t);
			if (result.error) {
				setError(result.error);
			} else {
				setSession(result.session);
			}
			setLoading(false);
		},
		[client],
	);

	useEffect(() => {
		if (!token) {
			setError({ code: "no_token", message: "No portal token provided" });
			setLoading(false);
			return;
		}
		void loadSession(token);
	}, [token, loadSession]);

	const submitIntent = useCallback(
		async (intents: Intent[]) => {
			if (!session || !token) {
				setError({ code: "not_ready", message: "Session not ready" });
				return;
			}
			setError(null);
			const result = await client.submitIntents(session.session_id, token, intents);
			if (result.error) {
				setError(result.error);
			} else if (result.session) {
				setSession(result.session);
			}
		},
		[client, session, token],
	);

	const uploadDocuments = useCallback(
		async (files: File[]) => {
			if (!session || !token) {
				setError({ code: "not_ready", message: "Session not ready" });
				return false;
			}
			setError(null);
			const result = await client.uploadDocuments(session.case_id, token, files);
			if (result.error) {
				setError(result.error);
				return false;
			}
			// Refresh so the checklist reflects the new documents.
			await loadSession(token);
			return true;
		},
		[client, session, token, loadSession],
	);

	return { session, loading, error, submitIntent, uploadDocuments };
}
