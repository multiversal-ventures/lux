import { getDefaultClient, getLuxToken } from "./runtime.js";

const API_V1 = "/api/v1";

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
 * SSE transport for `/api/v1/stream/:caseId` (Firebase Bearer in query).
 * Mirrors {@link apps/dashboard/src/hooks/useSSEConnection.ts} reconnect semantics.
 */
export class CaseSseTransport {
	private eventSource: EventSource | null = null;
	private retryCount = 0;
	private connectionEpoch = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private connectScheduled: (() => Promise<void>) | null = null;

	constructor(
		private readonly caseId: string,
		private readonly options: CaseSseTransportOptions,
	) {}

	private get maxRetries(): number {
		return this.options.maxRetries ?? 10;
	}

	private get retryDelay(): number {
		return this.options.retryDelay ?? 1000;
	}

	setConnectFn(fn: () => Promise<void>): void {
		this.connectScheduled = fn;
	}

	async connect(): Promise<void> {
		const caseId = this.caseId;
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}

		const startEpoch = this.connectionEpoch;
		this.options.onStreamStatus?.("connecting");

		const forceRefresh = this.retryCount > 0;
		let token: string | null = null;
		try {
			token = await getLuxToken(forceRefresh);
		} catch (err) {
			console.error("Failed to get auth token for SSE:", err);
			this.options.onStreamStatus?.("error");
			this.options.onError?.(new Error("Authentication failed"));
			return;
		}

		if (this.connectionEpoch !== startEpoch) return;
		const myEpoch = this.connectionEpoch;

		const params = new URLSearchParams();
		if (token) params.set("token", token);
		const lastId = this.options.getLastEventId();
		if (lastId) params.set("Last-Event-ID", lastId);

		const path = `${API_V1}/stream/${caseId}${params.toString() ? `?${params}` : ""}`;
		const absolute = getDefaultClient().toAbsoluteUrl(path);
		const es = new EventSource(absolute);
		this.eventSource = es;

		es.onopen = () => {
			if (this.connectionEpoch !== myEpoch || this.eventSource !== es) return;
			this.retryCount = 0;
			this.options.onStreamStatus?.("connected");
		};

		es.onerror = () => {
			if (this.connectionEpoch !== myEpoch || this.eventSource !== es) return;
			console.error("[CaseSseTransport] Connection error");
			this.options.onStreamStatus?.("disconnected");

			const completed = this.options.getCompleted();
			if (!completed && this.retryCount < this.maxRetries) {
				this.retryCount++;
				const delay = this.retryDelay * Math.min(this.retryCount, 5);
				const epochAtSchedule = this.connectionEpoch;
				if (this.reconnectTimer != null) clearTimeout(this.reconnectTimer);
				this.reconnectTimer = setTimeout(() => {
					this.reconnectTimer = null;
					if (this.connectionEpoch !== epochAtSchedule) return;
					void this.connectScheduled?.();
				}, delay);
			} else if (!completed) {
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
				es.addEventListener(type, (e) => handle(e as MessageEvent));
			}
			es.addEventListener("timeout", () => {});
			es.addEventListener("error", (e) => {
				try {
					const data = JSON.parse((e as MessageEvent).data || "{}");
					this.options.onError?.(new Error(String(data.error || "Unknown error")));
				} catch {
					/* normal reconnect */
				}
			});
		}
	}

	disconnect(): void {
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

	reconnect(): void {
		this.retryCount = 0;
		void this.connectScheduled?.();
	}
}
