import { VeritasSession, getDefaultClient } from "@fenero/lux-core";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { SessionContext } from "./context.js";

export function SessionProvider({ children }: { children: ReactNode }) {
	const session = useMemo(() => new VeritasSession(getDefaultClient()), []);
	const [, bump] = useState(0);

	useEffect(() => {
		return session.subscribe(() => bump((n) => n + 1));
	}, [session]);

	return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
