import { useSession } from "./useSession.js";

/** Alias for {@link useSession} until case-scoped session state is split out. */
export function useCase(): ReturnType<typeof useSession> {
	return useSession();
}
