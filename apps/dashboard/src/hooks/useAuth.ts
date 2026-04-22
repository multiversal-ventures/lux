import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { getFirebaseAuth } from "../lib/firebase";
import { useAppSelector } from "../store";

interface UseAuthReturn {
	user: User | null;
	loading: boolean;
	signOut: () => Promise<void>;
	/** Hydrated by `TenantProtectedRoute` from Gunnr `GET /api/v1/auth/me` (and optionally `GET /api/v1/tenants/me`). */
	tenantId: string | null;
	tenantName: string | null;
}

export function useAuth(): UseAuthReturn {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const tenantId = useAppSelector((s) => s.app.tenantId);
	const tenantName = useAppSelector((s) => s.app.tenantName);

	useEffect(() => {
		const auth = getFirebaseAuth();
		const unsubscribe = onAuthStateChanged(auth, (u) => {
			setUser(u);
			setLoading(false);
		});
		return () => unsubscribe();
	}, []);

	const signOut = async () => {
		await firebaseSignOut(getFirebaseAuth());
	};

	return { user, loading, signOut, tenantId, tenantName };
}
