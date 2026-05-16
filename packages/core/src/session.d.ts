import type { VeritasClient } from "./client.js";
import { CaseSseTransport, type CaseSseTransportOptions } from "./events.js";
/**
 * Composed session for Veritas-backed apps.
 *
 * Holds tenant + active case state, exposes a subscription primitive,
 * and owns at most one {@link CaseSseTransport} for the active case.
 *
 * SDK-pure: no product-specific intent dispatch. Apps that want typed
 * action dispatch should layer their own intent map on top.
 */
export declare class VeritasSession {
    readonly client: VeritasClient;
    tenantId: string | null;
    tenantName: string | null;
    /** Display name for the open case (dashboard header). */
    activeCaseName: string | null;
    private readonly listeners;
    private sse;
    constructor(client: VeritasClient);
    subscribe(listener: () => void): () => void;
    private notify;
    setTenant(tenantId: string | null, tenantName: string | null): void;
    setActiveCaseName(name: string | null): void;
    /**
     * Attach a case SSE transport. Replaces any previously attached transport.
     * Call {@link detachSse} on teardown.
     */
    attachSse(caseId: string, options: CaseSseTransportOptions): CaseSseTransport;
    getSse(): CaseSseTransport | null;
    detachSse(): void;
}
//# sourceMappingURL=session.d.ts.map