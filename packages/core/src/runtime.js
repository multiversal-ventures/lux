import { createVeritasClient } from "./client.js";
let _client = null;
let _auth = null;
/**
 * Initialize the default {@link VeritasClient} (call once from app bootstrap).
 */
export function initLux(config) {
    _auth = config.auth;
    _client = createVeritasClient({
        baseUrl: config.baseUrl,
        auth: config.auth,
        veritasVersion: config.veritasVersion,
        hooks: config.hooks,
    });
    return _client;
}
export function getDefaultClient() {
    if (!_client) {
        throw new Error("Lux SDK not initialized: call initLux() before using API helpers.");
    }
    return _client;
}
export function getAuthProvider() {
    if (!_auth) {
        throw new Error("Lux SDK not initialized: call initLux() before using auth.");
    }
    return _auth;
}
export function isLuxInitialized() {
    return _client !== null;
}
export async function getLuxToken(forceRefresh) {
    return getAuthProvider().getToken(forceRefresh);
}
//# sourceMappingURL=runtime.js.map