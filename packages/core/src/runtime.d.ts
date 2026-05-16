import type { AuthProvider } from "./auth.js";
import { type VeritasClient, type VeritasClientConfig } from "./client.js";
export type LuxInitConfig = Omit<VeritasClientConfig, "auth"> & {
    auth: AuthProvider;
};
/**
 * Initialize the default {@link VeritasClient} (call once from app bootstrap).
 */
export declare function initLux(config: LuxInitConfig): VeritasClient;
export declare function getDefaultClient(): VeritasClient;
export declare function getAuthProvider(): AuthProvider;
export declare function isLuxInitialized(): boolean;
export declare function getLuxToken(forceRefresh?: boolean): Promise<string | null>;
//# sourceMappingURL=runtime.d.ts.map