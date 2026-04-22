import { useSession } from "./useSession.js";

/**
 * Access to SSE transport on the session (`attachSse` / `detachSse` / `getSse`).
 */
export function useEvents() {
	const session = useSession();
	return {
		attachSse: session.attachSse.bind(session),
		detachSse: session.detachSse.bind(session),
		getSse: session.getSse.bind(session),
	};
}
