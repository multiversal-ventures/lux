import { getAuth, onAuthStateChanged, onIdTokenChanged } from "firebase/auth";
import type { User } from "firebase/auth";

/** Default Firebase Auth (same app as `initializeApp` in `main.tsx`). Prefer this over importing `getAuth` ad hoc. */
export function getFirebaseAuth() {
	return getAuth();
}

/**
 * Subscribe to Firebase ID token / user changes for the default app.
 * Use for long-lived image URLs, EventSource query params, etc. Session state in React uses {@link useAuth}.
 */
export function subscribeIdTokenChange(
	callback: (user: User | null) => void | Promise<void>,
): () => void {
	return onIdTokenChanged(getFirebaseAuth(), (user) => {
		void Promise.resolve(callback(user));
	});
}

let authReady = false;
let currentUser: User | null = null;

export function waitForAuth(): Promise<User | null> {
	if (authReady) {
		return Promise.resolve(currentUser);
	}
	return new Promise((resolve) => {
		const auth = getFirebaseAuth();
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			authReady = true;
			currentUser = user;
			unsubscribe();
			resolve(user);
		});
	});
}

export function isAuthenticated(): boolean {
	return authReady && currentUser !== null;
}

export function getCurrentUser(): User | null {
	return currentUser;
}
