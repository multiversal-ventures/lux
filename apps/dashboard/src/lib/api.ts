/**
 * Thin wrappers over `@fenero/lux-core` default client (initialized in `main.tsx`).
 */
import { APIError, getDefaultClient, getLuxToken } from "@fenero/lux-core";

export { APIError };

export function getGunnrApiBaseUrl(): string {
	const v = import.meta.env.VITE_GUNNR_API_URL as string | undefined;
	if (v == null || String(v).trim() === "") {
		return "";
	}
	return String(v).trim().replace(/\/$/, "");
}

export function resolveApiUrl(path: string): string {
	return getDefaultClient().resolvePath(path.startsWith("/") ? path : `/${path}`);
}

export async function apiRequest<T = unknown>(
	endpoint: string,
	options: RequestInit = {},
): Promise<T> {
	return getDefaultClient().requestJson<T>(endpoint, options);
}

export async function createEventSource(endpoint: string): Promise<EventSource> {
	const token = await getLuxToken();
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

export async function uploadFile<T = unknown>(
	endpoint: string,
	formData: FormData,
	options: RequestInit = {},
): Promise<T> {
	return getDefaultClient().uploadMultipart<T>(endpoint, formData, options);
}

/**
 * Convenience HTTP verbs (paths are absolute from app origin, often `/api/v1/...`).
 */
export const api = {
	get: <T = unknown>(endpoint: string, options?: RequestInit) =>
		getDefaultClient().requestJson<T>(endpoint, { ...options, method: "GET" }),

	post: <T = unknown>(endpoint: string, data?: unknown, options?: RequestInit) =>
		getDefaultClient().requestJson<T>(endpoint, {
			...options,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(options?.headers as Record<string, string>),
			},
			body: data !== undefined ? JSON.stringify(data) : undefined,
		}),

	put: <T = unknown>(endpoint: string, data?: unknown, options?: RequestInit) =>
		getDefaultClient().requestJson<T>(endpoint, {
			...options,
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				...(options?.headers as Record<string, string>),
			},
			body: data !== undefined ? JSON.stringify(data) : undefined,
		}),

	patch: <T = unknown>(endpoint: string, data?: unknown, options?: RequestInit) =>
		getDefaultClient().requestJson<T>(endpoint, {
			...options,
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				...(options?.headers as Record<string, string>),
			},
			body: data !== undefined ? JSON.stringify(data) : undefined,
		}),

	delete: <T = unknown>(endpoint: string, options?: RequestInit) =>
		getDefaultClient().requestJson<T>(endpoint, { ...options, method: "DELETE" }),
};
