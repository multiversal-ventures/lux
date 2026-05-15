import type { AuthProvider } from "./auth.js";
import { type VeritasClient, type VeritasClientConfig, createVeritasClient } from "./client.js";

export type LuxInitConfig = Omit<VeritasClientConfig, "auth"> & {
	auth: AuthProvider;
};

let _client: VeritasClient | null = null;
let _auth: AuthProvider | null = null;

/**
 * Initialize the default {@link VeritasClient} (call once from app bootstrap).
 */
export function initLux(config: LuxInitConfig): VeritasClient {
	_auth = config.auth;
	_client = createVeritasClient({
		baseUrl: config.baseUrl,
		auth: config.auth,
		veritasVersion: config.veritasVersion,
		hooks: config.hooks,
	});
	return _client;
}

export function getDefaultClient(): VeritasClient {
	if (!_client) {
		throw new Error("Lux SDK not initialized: call initLux() before using API helpers.");
	}
	return _client;
}

export function getAuthProvider(): AuthProvider {
	if (!_auth) {
		throw new Error("Lux SDK not initialized: call initLux() before using auth.");
	}
	return _auth;
}

export function isLuxInitialized(): boolean {
	return _client !== null;
}

export async function getLuxToken(forceRefresh?: boolean): Promise<string | null> {
	return getAuthProvider().getToken(forceRefresh);
}
