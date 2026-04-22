import type { LuxIntent } from "@fenero/lux-core";
import { useCallback } from "react";
import { useSession } from "./useSession.js";

export function useIntent(): (intent: LuxIntent | LuxIntent[]) => Promise<unknown | unknown[]> {
	const session = useSession();
	return useCallback((intent: LuxIntent | LuxIntent[]) => session.intent(intent), [session]);
}
