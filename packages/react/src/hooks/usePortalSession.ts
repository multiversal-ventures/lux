import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormPreviewResponse, Intent, IntentResult, PortalClientError, PortalSession, ThreadPage } from "@multiversal-ventures/lux-core";
import { createPortalClient } from "@multiversal-ventures/lux-core";

export interface UsePortalSessionReturn {
	session: PortalSession | null;
	loading: boolean;
	error: PortalClientError | null;
	/** Upload-only failure (bad file type, server rejection). Kept separate from
	 * `error` so a failed upload never trips the session-level "link unavailable"
	 * screen — the portal stays usable and the UI shows this inline instead. */
	uploadError: PortalClientError | null;
	clearUploadError: () => void;
	/** Submit intents and return the server's PER-INTENT outcomes.
	 *
	 * A refused intent is a 200 with `status: "error"` — `error` above stays
	 * null and the session comes back unchanged — so these results are the only
	 * evidence of a refusal. `[]` on transport failure or when the session
	 * isn't ready. Callers that only care about the session may ignore it. */
	submitIntent: (intents: Intent[]) => Promise<IntentResult[]>;
	/** Upload documents to the case, then refresh the session. Returns success. */
	uploadDocuments: (files: File[]) => Promise<boolean>;
	/** True while the loan officer is typing (live). */
	operatorTyping: boolean;
	/** Signal that the borrower is typing (best-effort, debounce at call site). */
	sendTyping: () => void;
	/** Load older chat messages before the given visible message timestamp. */
	loadMessagesBefore: (before: string) => Promise<ThreadPage | null>;
	/** Ask the server what the application form would look like if `inputs`
	 * were the borrower's answers — the same two lists the session carries.
	 *
	 * This exists so no client ever evaluates a `required_when` itself: lux's
	 * own evaluator compares with `===` and fails open on the list `equals`
	 * form DSCR's document rows rely on. `null` on a refusal or a transport
	 * failure, so a preview can never take the form down with it. */
	previewForm: (inputs: Record<string, unknown>) => Promise<FormPreviewResponse | null>;
}

/**
 * The verify proof lives in TAB-SCOPED sessionStorage, keyed to the token it
 * was minted for (the server binds the HMAC to that exact string, so a proof
 * from another token is useless and we must not send it).
 *
 * It was a `useRef`, which a page refresh wiped — the borrower was re-asked for
 * the access code every reload. sessionStorage is same-origin and per-tab, so a
 * new tab still asks, and the server's 12h TTL is unchanged.
 */
const PROOF_KEY = "lux.portal.verify";

function readProof(token: string | null): string | null {
	if (!token) return null;
	try {
		const raw = sessionStorage.getItem(PROOF_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as { token?: string; proof?: string };
		return parsed.token === token && parsed.proof ? parsed.proof : null;
	} catch {
		return null; // private mode, quota, or a hand-edited value
	}
}

function writeProof(token: string, proof: string): void {
	try {
		sessionStorage.setItem(PROOF_KEY, JSON.stringify({ token, proof }));
	} catch {
		/* storage unavailable — the session still works, it just re-asks on refresh */
	}
}

function clearProof(): void {
	try {
		sessionStorage.removeItem(PROOF_KEY);
	} catch {
		/* nothing to do */
	}
}

/**
 * Manage the lifecycle of a portal session for a given token.
 *
 * @param token - Portal token string (from URL, storage, etc.), or null to
 *   produce an immediate "no_token" error. The caller owns token sourcing.
 */
export function usePortalSession(
	token: string | null,
	options?: {
		/** Wrong-credential fallback for uploads: when the page is open in a
		 * browser also signed in as an operator/tenant, the portal token can be the
		 * wrong credential and the upload 401/403s. Return the signed-in user's
		 * Bearer token to retry with it (the backend still enforces case ownership).
		 * Real borrowers pass nothing → no fallback. */
		operatorTokenFallback?: () => Promise<string | null>;
	},
): UsePortalSessionReturn {
	const [session, setSession] = useState<PortalSession | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<PortalClientError | null>(null);
	const [uploadError, setUploadError] = useState<PortalClientError | null>(null);
	const [operatorTyping, setOperatorTyping] = useState(false);

	const client = useMemo(() => createPortalClient(), []);

	// Ephemeral verify-proof: the access code is a per-browser-session gate; the
	// claimed account is the only durable credential. The ref mirrors the
	// tab-scoped sessionStorage copy (see PROOF_KEY) so a refresh keeps the
	// borrower verified while a new tab still re-asks the code.
	const verifyProofRef = useRef<string | null>(null);

	// Read on mount and re-read when the token changes: a different loan's token
	// must not reuse the previous one's proof. Declared BEFORE the stream/load
	// effects (effects run in declaration order) so their first fetch sees it.
	useEffect(() => {
		verifyProofRef.current = readProof(token);
	}, [token]);

	// Absorb a fresh proof from any session response into the ref + storage; a
	// `requires_code` response means the server rejected ours, so drop it.
	const absorbProof = useCallback(
		(s: PortalSession | null) => {
			if (s?.requires_code) {
				verifyProofRef.current = null;
				clearProof();
				return;
			}
			if (s?.verify_proof && token) {
				verifyProofRef.current = s.verify_proof;
				writeProof(token, s.verify_proof);
			}
		},
		[token],
	);

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
		// `extraction.system.extracted` fires once PER DOCUMENT, so a ten-document case
		// emits a burst. Coalesce into one refetch on the trailing edge.
		let refetchTimer: ReturnType<typeof setTimeout> | undefined;
		const unsub = client.streamPortalEvents(token, (ping) => {
			// (stream gates on the same proof; pings only trigger a gated refetch)
			if (ping.type === "portal.typing") {
				if (ping.actor === "operator") {
					setOperatorTyping(true);
					if (typingTimer) clearTimeout(typingTimer);
					typingTimer = setTimeout(() => setOperatorTyping(false), 3000);
				}
			} else {
				if (refetchTimer) clearTimeout(refetchTimer);
				refetchTimer = setTimeout(() => void refreshSession(token), 400);
			}
		}, verifyProofRef.current);
		return () => {
			unsub();
			if (typingTimer) clearTimeout(typingTimer);
			if (refetchTimer) clearTimeout(refetchTimer);
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
		async (intents: Intent[]): Promise<IntentResult[]> => {
			if (!session || !token) {
				setError({ code: "not_ready", message: "Session not ready" });
				return [];
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
			// Returned even on the error branch (as `[]`) so callers have one shape
			// to read. A refusal arrives on the SUCCESS branch — 200, session
			// unchanged — which is exactly why this cannot be inferred from `error`.
			return result.results;
		},
		[client, session, token, absorbProof],
	);

	const uploadDocuments = useCallback(
		async (files: File[]) => {
			if (!session || !token) {
				setUploadError({ code: "not_ready", message: "Session not ready" });
				return false;
			}
			setUploadError(null);
			const result = await client.uploadDocuments(session.case_id, token, files, {
				operatorTokenFallback: options?.operatorTokenFallback,
			});
			if (result.error) {
				setUploadError(result.error);
				return false;
			}
			// Refresh so the checklist reflects the new documents.
			await loadSession(token);
			return true;
		},
		[client, session, token, loadSession, options?.operatorTokenFallback],
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

	const previewForm = useCallback(
		async (inputs: Record<string, unknown>): Promise<FormPreviewResponse | null> => {
			if (!session || !token) return null;
			const result = await client.previewPortalForm(
				session.session_id,
				token,
				inputs,
				verifyProofRef.current,
			);
			// A refused preview is deliberately NOT surfaced as a session error:
			// the form the borrower is typing into is still valid, and
			// `set_inputs` is what enforces the answers on submit.
			return result.preview;
		},
		[client, session, token],
	);

	const clearUploadError = useCallback(() => setUploadError(null), []);

	return {
		session,
		loading,
		error,
		uploadError,
		clearUploadError,
		submitIntent,
		uploadDocuments,
		operatorTyping,
		sendTyping,
		loadMessagesBefore,
		previewForm,
	};
}
