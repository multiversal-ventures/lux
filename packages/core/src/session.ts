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
export class VeritasSession {
	tenantId: string | null = null;
	tenantName: string | null = null;
	/** Display name for the open case (dashboard header). */
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
	 * Attach a case SSE transport. Replaces any previously attached transport.
	 * Call {@link detachSse} on teardown.
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
