import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import type { User } from "firebase/auth";

interface UseAuthReturn {
	user: User | null;
	loading: boolean;
	signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const auth = getAuth();
		const unsubscribe = onAuthStateChanged(auth, (u) => {
			setUser(u);
			setLoading(false);
		});
		return () => unsubscribe();
	}, []);

	const signOut = async () => {
		const auth = getAuth();
		await firebaseSignOut(auth);
	};

	return { user, loading, signOut };
}
