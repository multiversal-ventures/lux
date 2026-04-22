import type { User } from "firebase/auth";
import { signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { useContext, useEffect, useState } from "react";
import { FirebaseAuthGetterContext, SessionContext } from "./context.js";

export interface UseAuthReturn {
	user: User | null;
	loading: boolean;
	signOut: () => Promise<void>;
	tenantId: string | null;
	tenantName: string | null;
}

/**
 * Firebase user + tenant fields hydrated on {@link VeritasSession} (see `TenantProtectedRoute`).
 */
export function useAuth(): UseAuthReturn {
	const getAuth = useContext(FirebaseAuthGetterContext);
	const session = useContext(SessionContext);
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!getAuth) {
			setLoading(false);
			return;
		}
		const auth = getAuth();
		return onAuthStateChanged(auth, (u) => {
			setUser(u);
			setLoading(false);
		});
	}, [getAuth]);

	const signOut = async () => {
		if (!getAuth) return;
		await firebaseSignOut(getAuth());
	};

	return {
		user,
		loading,
		signOut,
		tenantId: session?.tenantId ?? null,
		tenantName: session?.tenantName ?? null,
	};
}
