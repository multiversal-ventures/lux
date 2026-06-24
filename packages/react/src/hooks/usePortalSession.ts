import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Intent, PortalClientError, PortalSession, ThreadPage } from "@multiversal-ventures/lux-core";
import { createPortalClient } from "@multiversal-ventures/lux-core";

export interface UsePortalSessionReturn {
	session: PortalSession | null;
	loading: boolean;
	error: PortalClientError | null;
	submitIntent: (intents: Intent[]) => Promise<void>;
	/** Upload documents to the case, then refresh the session. Returns success. */
	uploadDocuments: (files: File[]) => Promise<boolean>;
	/** True while the loan officer is typing (live). */
	operatorTyping: boolean;
	/** Signal that the borrower is typing (best-effort, debounce at call site). */
	sendTyping: () => void;
	/** Load older chat messages before the given visible message timestamp. */
	loadMessagesBefore: (before: string) => Promise<ThreadPage | null>;
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
	const [operatorTyping, setOperatorTyping] = useState(false);

	const client = useMemo(() => createPortalClient(), []);

	// Ephemeral verify-proof: the access code is a per-browser-session gate; the
	// claimed account is the only durable credential. The proof lives in MEMORY
	// ONLY (a ref — never localStorage/sessionStorage), so a page refresh / new
	// tab wipes it → no X-Portal-Verify header → if the borrower has no account
	// the server re-asks the code. After they verify (intent returns a proof) the
	// ref is set and in-session refetches stay verified.
	const verifyProofRef = useRef<string | null>(null);

	// Absorb a fresh proof from any session response into the in-memory ref.
	const absorbProof = useCallback((s: PortalSession | null) => {
		if (s?.verify_proof) verifyProofRef.current = s.verify_proof;
	}, []);

	// Silent refresh — updates the session without the loading flicker (used by
	// the real-time stream so new messages just appear).
	const refreshSession = useCallback(
		async (t: string) => {
			const result = await client.fetchSession(t, verifyProofRef.current);
			if (!result.error) {
				absorbProof(result.session);
				setSession(result.session);
			}
		},
		[client, absorbProof],
	);

	// Real-time: refetch the (privacy-gated) session on any portal ping; show a
	// typing indicator when the officer types. Pings carry no content.
	useEffect(() => {
		if (!token) return;
		let typingTimer: ReturnType<typeof setTimeout> | undefined;
		const unsub = client.streamPortalEvents(token, (ping) => {
			// (stream gates on the same proof; pings only trigger a gated refetch)
			if (ping.type === "portal.typing") {
				if (ping.actor === "operator") {
					setOperatorTyping(true);
					if (typingTimer) clearTimeout(typingTimer);
					typingTimer = setTimeout(() => setOperatorTyping(false), 3000);
				}
			} else {
				void refreshSession(token);
			}
		}, verifyProofRef.current);
		return () => {
			unsub();
			if (typingTimer) clearTimeout(typingTimer);
		};
	}, [token, client, refreshSession]);

	const sendTyping = useCallback(() => {
		if (token) void client.sendTyping(token);
	}, [client, token]);

	const loadSession = useCallback(
		async (t: string) => {
			setLoading(true);
			setError(null);
			const result = await client.fetchSession(t, verifyProofRef.current);
			if (result.error) {
				setError(result.error);
			} else {
				absorbProof(result.session);
				setSession(result.session);
			}
			setLoading(false);
		},
		[client, absorbProof],
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
			const result = await client.submitIntents(
				session.session_id,
				token,
				intents,
				verifyProofRef.current,
			);
			if (result.error) {
				setError(result.error);
			} else if (result.session) {
				// A verify intent returns a fresh proof — capture it so subsequent
				// in-session refetches stay verified (until a real refresh wipes it).
				absorbProof(result.session);
				setSession(result.session);
			}
		},
		[client, session, token, absorbProof],
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

	const loadMessagesBefore = useCallback(
		async (before: string) => {
			if (!session || !token) {
				setError({ code: "not_ready", message: "Session not ready" });
				return null;
			}
			const result = await client.fetchMessages(session.session_id, token, {
				before,
				verifyProof: verifyProofRef.current,
			});
			if (result.error) {
				setError(result.error);
				return null;
			}
			return result.page;
		},
		[client, session, token],
	);

	return {
		session,
		loading,
		error,
		submitIntent,
		uploadDocuments,
		operatorTyping,
		sendTyping,
		loadMessagesBefore,
	};
}
