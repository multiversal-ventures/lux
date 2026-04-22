import type { AuthProvider } from "./auth.js";
import type { components } from "./generated.js";

// ─────────────────────────────────────────────────────────────────────────────
// VeritasClient — typed HTTP client for Veritas / dashboard-style apps
// (Bearer tokens, optional Veritas-Version header, error hooks).
// ─────────────────────────────────────────────────────────────────────────────

export type ClientHooks = {
	onApiError?: (info: {
		error_type: string;
		error_message: string;
		error_code: string;
		page_url?: string;
		user_id?: string;
	}) => void;
};

export type VeritasClientConfig = {
	/** Optional API origin (no trailing slash). Empty = same-origin relative paths. */
	baseUrl: string;
	auth: AuthProvider;
	/** Sent as `Veritas-Version` when set. */
	veritasVersion?: string;
	hooks?: ClientHooks;
};

export class APIError extends Error {
	status: number;
	data?: unknown;

	constructor(message: string, status: number, data?: unknown) {
		super(message);
		this.name = "APIError";
		this.status = status;
		this.data = data;
	}
}

export function resolveApiPath(baseUrl: string, path: string): string {
	const trimmed = baseUrl.trim().replace(/\/$/, "");
	const p = path.startsWith("/") ? path : `/${path}`;
	if (!trimmed) return p;
	return `${trimmed}${p}`;
}

/**
 * Typed HTTP client for Veritas / Gunnr APIs (Bearer + optional Veritas-Version).
 */
export class VeritasClient {
	constructor(private readonly cfg: VeritasClientConfig) {}

	get baseUrl(): string {
		return this.cfg.baseUrl;
	}

	resolvePath(path: string): string {
		return resolveApiPath(this.cfg.baseUrl, path);
	}

	async requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
		const token = await this.cfg.auth.getToken();
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...(options.headers as Record<string, string>),
		};
		if (token) headers.Authorization = `Bearer ${token}`;
		const v = this.cfg.veritasVersion;
		if (v) headers["Veritas-Version"] = v;

		const method = (options.method || "GET").toUpperCase();
		const url = this.resolvePath(path);
		const t0 = typeof performance !== "undefined" ? performance.now() : 0;
		const response = await fetch(url, { ...options, headers });
		const elapsed = typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0;

		if (!response.ok) {
			console.warn(`[VeritasClient] ${method} ${url} → ${response.status} (${elapsed}ms)`);
		} else {
			console.debug(`[VeritasClient] ${method} ${url} → ${response.status} (${elapsed}ms)`);
		}

		if (!response.ok) {
			const text = await response.text();
			let errorData: unknown;
			try {
				errorData = text ? JSON.parse(text) : {};
			} catch {
				errorData = text || {};
			}
			const ed = errorData as Record<string, unknown>;
			let errorMessage: string;
			const detail = ed?.detail;
			if (typeof detail === "object" && detail !== null && "message" in detail) {
				errorMessage = String((detail as { message?: unknown }).message ?? "Error");
			} else if (typeof detail === "string") {
				errorMessage = detail;
			} else if (typeof ed?.message === "string") {
				errorMessage = ed.message;
			} else {
				errorMessage = `API Error: ${response.status}`;
			}
			const structured = typeof detail === "object" && detail !== null ? detail : errorData;
			const error = new APIError(errorMessage, response.status, structured);
			this.cfg.hooks?.onApiError?.({
				error_type: "server",
				error_message: error.message,
				error_code: String(response.status),
				page_url:
					typeof globalThis !== "undefined" && "location" in globalThis
						? globalThis.location.href
						: undefined,
			});
			throw error;
		}

		const contentType = response.headers.get("content-type");
		if (contentType?.includes("application/json")) {
			return (await response.json()) as T;
		}
		return (await response.text()) as T;
	}

	async uploadMultipart<T>(
		path: string,
		formData: FormData,
		options: RequestInit = {},
	): Promise<T> {
		const token = await this.cfg.auth.getToken();
		const headers: Record<string, string> = {
			...(options.headers as Record<string, string>),
		};
		if (token) headers.Authorization = `Bearer ${token}`;
		const v = this.cfg.veritasVersion;
		if (v) headers["Veritas-Version"] = v;

		const url = this.resolvePath(path);
		const response = await fetch(url, {
			...options,
			method: "POST",
			headers,
			body: formData,
		});

		if (!response.ok) {
			const text = await response.text();
			let errorData: unknown;
			try {
				errorData = text ? JSON.parse(text) : {};
			} catch {
				errorData = text || {};
			}
			const ed = errorData as Record<string, unknown>;
			throw new APIError(
				String(ed?.detail ?? `Upload failed: ${response.status}`),
				response.status,
				errorData,
			);
		}
		return (await response.json()) as T;
	}

	/**
	 * Build absolute URL for `EventSource` when `baseUrl` is empty (browser resolves against `location.origin`).
	 */
	toAbsoluteUrl(path: string): string {
		const resolved = this.resolvePath(path);
		if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
			return resolved;
		}
		const origin =
			typeof globalThis !== "undefined" && "location" in globalThis
				? (globalThis as unknown as { location: { origin: string } }).location.origin
				: "http://localhost";
		return new URL(resolved, origin).toString();
	}
}

export function createVeritasClient(cfg: VeritasClientConfig): VeritasClient {
	return new VeritasClient(cfg);
}

// ─────────────────────────────────────────────────────────────────────────────
// PortalClient — minimal session client for the borrower portal
// (X-Portal-Token header, /portal/session + /portal/session/:id/intents).
// ─────────────────────────────────────────────────────────────────────────────

type PortalSession = components["schemas"]["PortalSessionResponse"];
type Intent = components["schemas"]["Intent"];

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
				headers: { "X-Portal-Token": token },
			});
			if (!res.ok) {
				if (res.status === 401) {
					return {
						session: null,
						error: {
							code: "expired",
							message: "Session has expired. Please request a new link.",
							status: 401,
						},
					};
				}
				return {
					session: null,
					error: {
						code: "server",
						message: `Failed to load session (${res.status})`,
						status: res.status,
					},
				};
			}
			const session: PortalSession = await res.json();
			return { session, error: null };
		} catch {
			return {
				session: null,
				error: { code: "network", message: "Failed to connect to server" },
			};
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
					"X-Portal-Token": token,
				},
				body: JSON.stringify({ intents }),
			});
			if (!res.ok) {
				return {
					session: null,
					error: {
						code: "server",
						message: `Failed to submit (${res.status})`,
						status: res.status,
					},
				};
			}
			const data: { session: PortalSession } = await res.json();
			return { session: data.session, error: null };
		} catch {
			return { session: null, error: { code: "network", message: "Failed to submit" } };
		}
	}

	return { fetchSession, submitIntents };
}
