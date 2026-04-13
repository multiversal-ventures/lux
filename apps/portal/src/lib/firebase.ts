import { getAuth, onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";

let authReady = false;
let currentUser: User | null = null;

export function waitForAuth(): Promise<User | null> {
	if (authReady) {
		return Promise.resolve(currentUser);
	}
	return new Promise((resolve) => {
		const auth = getAuth();
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
