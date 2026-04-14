import { useState, useEffect } from "react";

interface ChecklistItem {
	id: string;
	status: string;
	title: string;
	detail: string;
	action: string;
	priority: string;
	finding_code: string;
	display_hints: {
		component: string;
		accept: string | null;
		label: string | null;
	};
}

interface ConsentState {
	sms_opt_in: boolean;
	email_opt_in: boolean;
	doc_sharing: boolean;
	electronic_records: boolean;
	credit_pull: boolean;
}

interface PortalSession {
	session_id: string;
	entity: {
		identity_id: string;
		name: string;
		role: string;
	};
	case_id: string;
	case_state: string;
	checklist: ChecklistItem[];
	consent: ConsentState;
	verification: { level: number; verified: boolean };
	upload_config: {
		max_file_size_mb: number;
		accepted_types: string[];
		endpoint: string;
	};
}

interface Intent {
	type: string;
	params: Record<string, unknown>;
}

interface UsePortalSessionReturn {
	session: PortalSession | null;
	loading: boolean;
	error: string | null;
	token: string | null;
	submitIntent: (intent: Intent | Intent[]) => Promise<void>;
}

export function usePortalSession(): UsePortalSessionReturn {
	const [session, setSession] = useState<PortalSession | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [token, setToken] = useState<string | null>(null);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const t = params.get("token");
		setToken(t);

		if (!t) {
			setError("No portal token provided");
			setLoading(false);
			return;
		}

		fetchSession(t);
	}, []);

	async function fetchSession(t: string) {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(`/api/portal/session?token=${t}`);
			if (!res.ok) {
				if (res.status === 401) {
					setError("expired");
				} else {
					setError(`Failed to load session (${res.status})`);
				}
				return;
			}
			const data: PortalSession = await res.json();
			setSession(data);
		} catch {
			setError("Failed to connect to server");
		} finally {
			setLoading(false);
		}
	}

	async function submitIntent(intent: Intent | Intent[]) {
		if (!session || !token) return;

		const intents = Array.isArray(intent) ? intent : [intent];

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
				const data = await res.json();
				setSession(data.session);
			}
		} catch {
			setError("Failed to submit");
		}
	}

	return { session, loading, error, token, submitIntent };
}
