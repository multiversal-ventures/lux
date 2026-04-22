import { getDefaultClient } from "./runtime.js";

const API_V1 = "/api/v1";

/**
 * Gunnr REST paths under `/api/v1`.
 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
	return getDefaultClient().requestJson<T>(`${API_V1}${path}`, options);
}

/**
 * Paths outside `/api/v1` (e.g. `/api/case/.../income/advisor/status`).
 */
export async function apiFetchRoot<T>(path: string, options?: RequestInit): Promise<T> {
	return getDefaultClient().requestJson<T>(path, options);
}
