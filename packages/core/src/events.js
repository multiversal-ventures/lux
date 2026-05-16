import { getDefaultClient, getLuxToken } from "./runtime.js";
const API_V1 = "/api/v1";
/**
 * SSE transport for `/api/v1/stream/:caseId` (Bearer token in query via {@link getLuxToken}).
 * Mirrors {@link apps/dashboard/src/hooks/useSSEConnection.ts} reconnect semantics.
 */
export class CaseSseTransport {
    caseId;
    options;
    eventSource = null;
    retryCount = 0;
    connectionEpoch = 0;
    reconnectTimer = null;
    connectScheduled = null;
    constructor(caseId, options) {
        this.caseId = caseId;
        this.options = options;
    }
    get maxRetries() {
        return this.options.maxRetries ?? 10;
    }
    get retryDelay() {
        return this.options.retryDelay ?? 1000;
    }
    setConnectFn(fn) {
        this.connectScheduled = fn;
    }
    async connect() {
        const caseId = this.caseId;
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        const startEpoch = this.connectionEpoch;
        this.options.onStreamStatus?.("connecting");
        const forceRefresh = this.retryCount > 0;
        let token = null;
        try {
            token = await getLuxToken(forceRefresh);
        }
        catch (err) {
            console.error("Failed to get auth token for SSE:", err);
            this.options.onStreamStatus?.("error");
            this.options.onError?.(new Error("Authentication failed"));
            return;
        }
        if (this.connectionEpoch !== startEpoch)
            return;
        const myEpoch = this.connectionEpoch;
        const params = new URLSearchParams();
        if (token)
            params.set("token", token);
        const lastId = this.options.getLastEventId();
        if (lastId)
            params.set("Last-Event-ID", lastId);
        const path = `${API_V1}/stream/${caseId}${params.toString() ? `?${params}` : ""}`;
        const absolute = getDefaultClient().toAbsoluteUrl(path);
        const es = new EventSource(absolute);
        this.eventSource = es;
        es.onopen = () => {
            if (this.connectionEpoch !== myEpoch || this.eventSource !== es)
                return;
            this.retryCount = 0;
            this.options.onStreamStatus?.("connected");
        };
        es.onerror = () => {
            if (this.connectionEpoch !== myEpoch || this.eventSource !== es)
                return;
            console.error("[CaseSseTransport] Connection error");
            this.options.onStreamStatus?.("disconnected");
            const completed = this.options.getCompleted();
            if (!completed && this.retryCount < this.maxRetries) {
                this.retryCount++;
                const delay = this.retryDelay * Math.min(this.retryCount, 5);
                const epochAtSchedule = this.connectionEpoch;
                if (this.reconnectTimer != null)
                    clearTimeout(this.reconnectTimer);
                this.reconnectTimer = setTimeout(() => {
                    this.reconnectTimer = null;
                    if (this.connectionEpoch !== epochAtSchedule)
                        return;
                    void this.connectScheduled?.();
                }, delay);
            }
            else if (!completed) {
                this.options.onStreamStatus?.("error");
                this.options.onError?.(new Error("Max retries exceeded"));
            }
        };
        const handle = this.options.onMessage;
        if (handle) {
            es.onmessage = handle;
            const eventTypes = [
                "phase",
                "thinking",
                "observation",
                "action",
                "finding",
                "issue",
                "complete",
                "retry",
                "fatal",
            ];
            for (const type of eventTypes) {
                es.addEventListener(type, (e) => handle(e));
            }
            es.addEventListener("timeout", () => { });
            es.addEventListener("error", (e) => {
                try {
                    const data = JSON.parse(e.data || "{}");
                    this.options.onError?.(new Error(String(data.error || "Unknown error")));
                }
                catch {
                    /* normal reconnect */
                }
            });
        }
    }
    disconnect() {
        if (this.reconnectTimer != null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.connectionEpoch += 1;
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        this.options.onStreamStatus?.("idle");
    }
    reconnect() {
        this.retryCount = 0;
        void this.connectScheduled?.();
    }
}
//# sourceMappingURL=events.js.map