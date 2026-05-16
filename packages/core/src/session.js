import { CaseSseTransport } from "./events.js";
/**
 * Composed session for Veritas-backed apps.
 *
 * Holds tenant + active case state, exposes a subscription primitive,
 * and owns at most one {@link CaseSseTransport} for the active case.
 *
 * SDK-pure: no product-specific intent dispatch. Apps that want typed
 * action dispatch should layer their own intent map on top.
 */
export class VeritasSession {
    client;
    tenantId = null;
    tenantName = null;
    /** Display name for the open case (dashboard header). */
    activeCaseName = null;
    listeners = new Set();
    sse = null;
    constructor(client) {
        this.client = client;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    notify() {
        for (const l of this.listeners)
            l();
    }
    setTenant(tenantId, tenantName) {
        this.tenantId = tenantId;
        this.tenantName = tenantName;
        this.notify();
    }
    setActiveCaseName(name) {
        this.activeCaseName = name;
        this.notify();
    }
    /**
     * Attach a case SSE transport. Replaces any previously attached transport.
     * Call {@link detachSse} on teardown.
     */
    attachSse(caseId, options) {
        this.detachSse();
        const transport = new CaseSseTransport(caseId, options);
        transport.setConnectFn(() => transport.connect());
        this.sse = transport;
        return transport;
    }
    getSse() {
        return this.sse;
    }
    detachSse() {
        this.sse?.disconnect();
        this.sse = null;
    }
}
//# sourceMappingURL=session.js.map