/**
 * Pluggable auth for {@link VeritasClient}. Implement with your identity provider
 * (OIDC, magic link, portal token, etc.) — the SDK only needs a Bearer token.
 */
export interface AuthProvider {
	getToken(forceRefresh?: boolean): Promise<string | null>;
}

/**
 * Bearer token from Veritas portal flow (documented SDK path).
 */
export class PortalTokenAuthProvider implements AuthProvider {
	constructor(private readonly token: string) {}

	getToken(): Promise<string | null> {
		return Promise.resolve(this.token);
	}
}
