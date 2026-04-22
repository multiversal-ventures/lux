/**
 * @fenero/lux-core — Veritas types, HTTP client, Gunnr dashboard API, session, intents, SSE transport.
 */
export type { paths, components, operations } from "./generated.js";
export * from "./auth.js";
export { createVeritasClient, VeritasClient, APIError, resolveApiPath } from "./client.js";
export type { VeritasClientConfig, ClientHooks } from "./client.js";
export {
	initLux,
	getDefaultClient,
	getAuthProvider,
	isLuxInitialized,
	getLuxToken,
	type LuxInitConfig,
} from "./runtime.js";
export { apiFetch, apiFetchRoot } from "./gunnr-http.js";
export * from "./gunnr-types.js";
export * from "./gunnr-api.js";
export { CaseSseTransport } from "./events.js";
export type { CaseSseTransportOptions, CaseSseMessageHandler } from "./events.js";
export { dispatchLuxIntent, dispatchLuxIntents, type LuxIntent } from "./intents.js";
export { VeritasSession } from "./session.js";
export * as queries from "./queries/index.js";
