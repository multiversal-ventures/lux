/**
 * Pluggable auth for {@link VeritasClient}. Dashboard uses Firebase; portal uses a static portal token.
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

export type FirebaseAuthGetter = () => import("firebase/auth").Auth;

/**
 * Bridges Firebase Auth to {@link AuthProvider}. Caller supplies `getAuth` from the initialized Firebase app.
 */
export function createFirebaseAuthProvider(getAuth: FirebaseAuthGetter): AuthProvider {
	return {
		async getToken(forceRefresh?: boolean): Promise<string | null> {
			const user = getAuth().currentUser;
			if (!user) return null;
			try {
				return await user.getIdToken(Boolean(forceRefresh));
			} catch {
				return null;
			}
		},
	};
}
