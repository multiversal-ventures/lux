/** Lifecycle of a {@link CaseSseTransport} connection. */
export type StreamStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";
export type CaseSseMessageHandler = (event: MessageEvent) => void;
export type CaseSseTransportOptions = {
    /** Last SSE id for resume (maps to `Last-Event-ID` query param). */
    getLastEventId: () => string | null;
    getCompleted: () => boolean;
    maxRetries?: number;
    retryDelay?: number;
    onStreamStatus?: (status: StreamStatus) => void;
    /** Raw browser `MessageEvent` (default handler parses JSON `StreamEvent` if needed). */
    onMessage?: CaseSseMessageHandler;
    onError?: (error: Error) => void;
};
/**
 * SSE transport for `/api/v1/stream/:caseId` (Bearer token in query via {@link getLuxToken}).
 * Mirrors {@link apps/dashboard/src/hooks/useSSEConnection.ts} reconnect semantics.
 */
export declare class CaseSseTransport {
    private readonly caseId;
    private readonly options;
    private eventSource;
    private retryCount;
    private connectionEpoch;
    private reconnectTimer;
    private connectScheduled;
    constructor(caseId: string, options: CaseSseTransportOptions);
    private get maxRetries();
    private get retryDelay();
    setConnectFn(fn: () => Promise<void>): void;
    connect(): Promise<void>;
    disconnect(): void;
    reconnect(): void;
}
//# sourceMappingURL=events.d.ts.map