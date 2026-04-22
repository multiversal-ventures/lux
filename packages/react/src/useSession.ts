import type { VeritasSession } from "@fenero/lux-core";
import { useContext } from "react";
import { SessionContext } from "./context.js";

export function useSession(): VeritasSession {
	const s = useContext(SessionContext);
	if (!s) {
		throw new Error("useSession must be used within <SessionProvider>");
	}
	return s;
}
