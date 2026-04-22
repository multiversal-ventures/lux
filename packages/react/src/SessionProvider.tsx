import { VeritasSession, getDefaultClient } from "@fenero/lux-core";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { type FirebaseAuthGetter, FirebaseAuthGetterContext, SessionContext } from "./context.js";

export type { FirebaseAuthGetter };

export function SessionProvider({
	children,
	firebaseAuth,
}: {
	children: ReactNode;
	/** Optional. Required only if consumers call {@link useAuth}. */
	firebaseAuth?: FirebaseAuthGetter;
}) {
	const session = useMemo(() => new VeritasSession(getDefaultClient()), []);
	const [, bump] = useState(0);

	useEffect(() => {
		return session.subscribe(() => bump((n) => n + 1));
	}, [session]);

	return (
		<FirebaseAuthGetterContext.Provider value={firebaseAuth ?? null}>
			<SessionContext.Provider value={session}>{children}</SessionContext.Provider>
		</FirebaseAuthGetterContext.Provider>
	);
}
