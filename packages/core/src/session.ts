import type { VeritasClient } from "./client.js";
import { CaseSseTransport, type CaseSseTransportOptions } from "./events.js";
import { type LuxIntent, dispatchLuxIntent, dispatchLuxIntents } from "./intents.js";

/**
 * Composed session for dashboard-style apps: tenant hints + optional SSE + {@link intent}.
 * Portal flows can extend this later with checklist / uploadConfig from Veritas.
 */
export class VeritasSession {
	tenantId: string | null = null;
	tenantName: string | null = null;
	/** Display name for the open case (LO dashboard header). */
	activeCaseName: string | null = null;
	private readonly listeners = new Set<() => void>();
	private sse: CaseSseTransport | null = null;

	constructor(readonly client: VeritasClient) {}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		for (const l of this.listeners) l();
	}

	setTenant(tenantId: string | null, tenantName: string | null): void {
		this.tenantId = tenantId;
		this.tenantName = tenantName;
		this.notify();
	}

	setActiveCaseName(name: string | null): void {
		this.activeCaseName = name;
		this.notify();
	}

	/**
	 * Dispatch one or more intents (batch is serial until backend supports batch).
	 */
	async intent(i: LuxIntent | LuxIntent[]): Promise<unknown | unknown[]> {
		if (Array.isArray(i)) return dispatchLuxIntents(i);
		return dispatchLuxIntent(i);
	}

	/**
	 * Attach Gunnr case SSE transport. Call {@link detachSse} on teardown.
	 */
	attachSse(caseId: string, options: CaseSseTransportOptions): CaseSseTransport {
		this.detachSse();
		const transport = new CaseSseTransport(caseId, options);
		transport.setConnectFn(() => transport.connect());
		this.sse = transport;
		return transport;
	}

	getSse(): CaseSseTransport | null {
		return this.sse;
	}

	detachSse(): void {
		this.sse?.disconnect();
		this.sse = null;
	}
}
