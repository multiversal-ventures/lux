/**
 * Authenticated API client for Gunnr backend
 *
 * Automatically includes Firebase authentication token in all requests
 */

import { getFirebaseAuth } from "./firebase";
import { trackError } from "./mixpanel";

/**
 * Optional absolute origin for the Gunnr HTTP API (no trailing slash).
 * When unset, requests stay same-origin and Vite dev proxy handles `/api`.
 */
export function getGunnrApiBaseUrl(): string {
	const v = import.meta.env.VITE_GUNNR_API_URL as string | undefined;
	if (v == null || String(v).trim() === "") {
		return "";
	}
	return String(v).trim().replace(/\/$/, "");
}

/** Prefix a path (e.g. `/api/v1/...`) with {@link getGunnrApiBaseUrl} when configured. */
export function resolveApiUrl(path: string): string {
	const base = getGunnrApiBaseUrl();
	const p = path.startsWith("/") ? path : `/${path}`;
	if (!base) {
		return p;
	}
	return `${base}${p}`;
}

export class APIError extends Error {
	status: number;
	data?: any;

	constructor(message: string, status: number, data?: any) {
		super(message);
		this.name = "APIError";
		this.status = status;
		this.data = data;
	}
}

/**
 * Get current user's Firebase ID token
 */
async function getAuthToken(): Promise<string | null> {
	const user = getFirebaseAuth().currentUser;

	if (!user) {
		return null;
	}

	try {
		// Get fresh token (auto-refreshes if needed)
		return await user.getIdToken();
	} catch (error) {
		console.error("Failed to get auth token:", error);
		return null;
	}
}

/**
 * Make authenticated API request
 *
 * Automatically adds Authorization header with Firebase token
 *
 * @example
 * ```ts
 * // GET request
 * const data = await apiRequest('/api/v1/case/123/status');
 *
 * // POST request
 * const result = await apiRequest('/api/v1/case/start', {
 *   method: 'POST',
 *   body: JSON.stringify({ files: [...] })
 * });
 * ```
 */
export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
	// Get auth token
	const token = await getAuthToken();

	// Build headers
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...(options.headers as Record<string, string>),
	};

	// Add Authorization header if we have a token
	if (token) {
		headers["Authorization"] = `Bearer ${token}`;
	}

	// Make request
	const method = (options.method || "GET").toUpperCase();
	const t0 = performance.now();
	const url = resolveApiUrl(endpoint);
	const response = await fetch(url, {
		...options,
		headers,
	});
	const elapsed = Math.round(performance.now() - t0);

	if (!response.ok) {
		console.warn(`[API] ${method} ${url} → ${response.status} (${elapsed}ms)`);
	} else {
		console.debug(`[API] ${method} ${url} → ${response.status} (${elapsed}ms)`);
	}

	// Handle errors (read body once - Fetch body stream can only be read once)
	if (!response.ok) {
		const text = await response.text();
		let errorData: any;
		try {
			errorData = text ? JSON.parse(text) : {};
		} catch {
			errorData = text || {};
		}

		console.warn(`[API] Error detail:`, errorData);

		// Handle structured error details (e.g., { code: 'PAGE_LIMIT_EXCEEDED', message: '...' })
		let errorMessage: string;
		if (typeof errorData?.detail === "object" && errorData.detail?.message) {
			// Structured error from backend
			errorMessage = errorData.detail.message;
		} else if (typeof errorData?.detail === "string") {
			errorMessage = errorData.detail;
		} else if (typeof errorData?.message === "string") {
			errorMessage = errorData.message;
		} else {
			errorMessage = `API Error: ${response.status}`;
		}

		// Store the full detail object for structured error handling
		const error = new APIError(
			errorMessage,
			response.status,
			typeof errorData?.detail === "object" ? errorData.detail : errorData,
		);
		trackError({
			error_type: "server",
			error_message: error.message,
			error_code: String(response.status),
			page_url: typeof window !== "undefined" ? window.location.href : undefined,
			user_id: getFirebaseAuth().currentUser?.uid,
		});
		throw error;
	}

	// Parse response
	const contentType = response.headers.get("content-type");
	if (contentType?.includes("application/json")) {
		return await response.json();
	}

	return (await response.text()) as any;
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
	get: <T = any>(endpoint: string, options?: RequestInit) =>
		apiRequest<T>(endpoint, { ...options, method: "GET" }),

	post: <T = any>(endpoint: string, data?: any, options?: RequestInit) =>
		apiRequest<T>(endpoint, {
			...options,
			method: "POST",
			body: data ? JSON.stringify(data) : undefined,
		}),

	put: <T = any>(endpoint: string, data?: any, options?: RequestInit) =>
		apiRequest<T>(endpoint, {
			...options,
			method: "PUT",
			body: data ? JSON.stringify(data) : undefined,
		}),

	patch: <T = any>(endpoint: string, data?: any, options?: RequestInit) =>
		apiRequest<T>(endpoint, {
			...options,
			method: "PATCH",
			body: data ? JSON.stringify(data) : undefined,
		}),

	delete: <T = any>(endpoint: string, options?: RequestInit) =>
		apiRequest<T>(endpoint, { ...options, method: "DELETE" }),
};

/**
 * SSE (Server-Sent Events) streaming
 *
 * @example
 * ```ts
 * const eventSource = createEventSource('/api/v1/stream/case-123');
 *
 * eventSource.addEventListener('page_result', (event) => {
 *   const data = JSON.parse(event.data);
 *   console.log('Page result:', data);
 * });
 *
 * eventSource.addEventListener('error', (error) => {
 *   console.error('Stream error:', error);
 *   eventSource.close();
 * });
 * ```
 */
export async function createEventSource(endpoint: string): Promise<EventSource> {
	const token = await getAuthToken();

	if (!token) {
		throw new Error("Authentication required for event streams");
	}

	const resolved = resolveApiUrl(endpoint);
	const url = new URL(
		resolved,
		resolved.startsWith("http://") || resolved.startsWith("https://")
			? undefined
			: window.location.origin,
	);
	url.searchParams.set("token", token);

	return new EventSource(url.toString());
}

/**
 * Upload file with authentication
 *
 * @example
 * ```ts
 * const formData = new FormData();
 * formData.append('file', fileBlob, 'document.pdf');
 *
 * const result = await uploadFile('/api/v1/case/upload', formData);
 * ```
 */
export async function uploadFile<T = any>(
	endpoint: string,
	formData: FormData,
	options: RequestInit = {},
): Promise<T> {
	const token = await getAuthToken();

	const headers: Record<string, string> = {
		...(options.headers as Record<string, string>),
	};

	// Add Authorization header if we have a token
	if (token) {
		headers["Authorization"] = `Bearer ${token}`;
	}

	// Don't set Content-Type - browser will set it with boundary for multipart/form-data

	const url = resolveApiUrl(endpoint);
	const response = await fetch(url, {
		...options,
		method: "POST",
		headers,
		body: formData,
	});

	if (!response.ok) {
		const text = await response.text();
		let errorData: any;
		try {
			errorData = text ? JSON.parse(text) : {};
		} catch {
			errorData = text || {};
		}

		throw new APIError(
			errorData?.detail || `Upload failed: ${response.status}`,
			response.status,
			errorData,
		);
	}

	return await response.json();
}
