import { useCallback, useEffect, useState } from "react";
import {
	getAuth,
	onAuthStateChanged,
	signOut as firebaseSignOut,
} from "firebase/auth";
import type { User } from "firebase/auth";

interface UseAuthReturn {
	user: User | null;
	loading: boolean;
	signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	const onAuthChange = useCallback((u: User | null) => {
		setUser(u);
		setLoading(false);
	}, []);

	useEffect(() => {
		const auth = getAuth();
		const unsubscribe = onAuthStateChanged(auth, onAuthChange);
		return () => unsubscribe();
	}, [onAuthChange]);

	const signOut = useCallback(async () => {
		try {
			const auth = getAuth();
			await firebaseSignOut(auth);
		} catch {
			// Firebase sign-out failures are non-recoverable from the UI perspective;
			// the auth state listener will reflect truth regardless.
		}
	}, []);

	return { user, loading, signOut };
}
