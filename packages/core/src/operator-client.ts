/**
 * Operator client — bearer-token authenticated access to Veritas.
 *
 * Covers the full case lifecycle: spec generation, case creation,
 * file upload, event streaming, audit retrieval. All paths include
 * the /api prefix used by the Veritas API router.
 */

import type { components } from "./generated";

export type CaseResponse = components["schemas"]["CaseResponse"];
export type SpecAuditResponse = components["schemas"]["SpecAuditResponse"];
export type CalculationStepResponse = components["schemas"]["CalculationStepResponse"];
export type SpecResponse = components["schemas"]["SpecResponse"];

export interface CaseEvent {
	event_id: number;
	event_type: string;
	event_data: Record<string, unknown> | null;
	created_at: string | null;
}

export interface GenerateSpecResult {
	yaml: string;
	name: string;
	domain: string;
	version: string;
}

export interface OperatorClientConfig {
	/** Base URL of the Veritas API. Empty string = same origin (Vite proxy). */
	baseUrl?: string;
	/** Bearer token from `veritas tenant issue-credential`. */
	bearerToken: string;
}

export interface OperatorClientError {
	status: number;
	message: string;
}

export type Result<T> =
	| { data: T; error: null }
	| { data: null; error: OperatorClientError };

export function createOperatorClient(config: OperatorClientConfig) {
	const base = config.baseUrl ?? "";
	const token = config.bearerToken;

	function authHeaders(extra?: Record<string, string>): Record<string, string> {
		return { Authorization: `Bearer ${token}`, ...extra };
	}

	async function request<T>(res: Response): Promise<Result<T>> {
		if (!res.ok) {
			const message = await res.text().catch(() => res.statusText);
			return { data: null, error: { status: res.status, message } };
		}
		const data = (await res.json()) as T;
		return { data, error: null };
	}

	// -------------------------------------------------------------------------
	// Spec management
	// -------------------------------------------------------------------------

	/**
	 * Stream spec YAML token-by-token from POST /api/ai/specs/generate/stream.
	 * Calls onChunk for each raw text delta. Resolves with parsed meta when done.
	 */
	async function generateSpecStream(
		description: string,
		onChunk: (chunk: string) => void,
	): Promise<Result<GenerateSpecResult>> {
		try {
			const res = await fetch(`${base}/api/ai/specs/generate/stream`, {
				method: "POST",
				headers: authHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ description }),
			});
			if (!res.ok || !res.body) {
				const msg = await res.text().catch(() => res.statusText);
				return { data: null, error: { status: res.status, message: msg } };
			}
			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			let yaml = "";
			type MetaType = { name: string; domain: string; version: string };
			let meta: MetaType | null = null;

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n\n");
				buffer = lines.pop() ?? "";
				for (const block of lines) {
					for (const line of block.split("\n")) {
						if (!line.startsWith("data: ")) continue;
						const raw = line.slice(6).trim();
						if (!raw) continue;
						// Each chunk is JSON-encoded: "data: \"token text\""
						// META chunk: "data: \"\\nMETA:{...}\""
						let decoded: string;
						try {
							decoded = JSON.parse(raw) as string;
						} catch {
							decoded = raw; // fallback: treat as plain text
						}
						if (decoded.includes("\nMETA:")) {
							const idx = decoded.indexOf("\nMETA:");
							const text = decoded.slice(0, idx);
							const metaJson = decoded.slice(idx + 6);
							if (text) { yaml += text; onChunk(text); }
							try { meta = JSON.parse(metaJson) as MetaType; } catch { /* skip */ }
						} else if (decoded.startsWith("META:")) {
							try { meta = JSON.parse(decoded.slice(5)) as MetaType; } catch { /* skip */ }
						} else if (decoded.startsWith('{"error"')) {
							const err = JSON.parse(decoded) as { error: string };
							return { data: null, error: { status: 502, message: err.error } };
						} else {
							yaml += decoded;
							onChunk(decoded);
						}
					}
				}
			}

			if (!meta) return { data: null, error: { status: 500, message: "No metadata in stream" } };
			return { data: { yaml, name: meta.name, domain: meta.domain, version: meta.version }, error: null };
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function generateSpec(description: string): Promise<Result<GenerateSpecResult>> {
		try {
			const res = await fetch(`${base}/api/ai/specs/generate`, {
				method: "POST",
				headers: authHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ description }),
			});
			return request<GenerateSpecResult>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function getSpecDetail(specId: string): Promise<Result<SpecResponse & { yaml_content?: string | null }>> {
		try {
			const res = await fetch(`${base}/api/specs/${specId}`, { headers: authHeaders() });
			return request<SpecResponse & { yaml_content?: string | null }>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function listSpecs(domain?: string): Promise<Result<SpecResponse[]>> {
		try {
			const url = domain
				? `${base}/api/specs?domain=${encodeURIComponent(domain)}`
				: `${base}/api/specs`;
			const res = await fetch(url, { headers: authHeaders() });
			return request<SpecResponse[]>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function createSpec(payload: {
		name: string;
		domain: string;
		version: string;
		yaml_content: string;
		description?: string;
	}): Promise<Result<{ spec_id: string }>> {
		try {
			const res = await fetch(`${base}/api/specs`, {
				method: "POST",
				headers: authHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify(payload),
			});
			return request<{ spec_id: string }>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function submitSpec(specId: string): Promise<Result<unknown>> {
		try {
			const res = await fetch(`${base}/api/specs/${specId}/submit`, {
				method: "PUT",
				headers: authHeaders(),
			});
			return request<unknown>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function approveSpec(specId: string): Promise<Result<unknown>> {
		try {
			const res = await fetch(`${base}/api/specs/${specId}/approve`, {
				method: "PUT",
				headers: authHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ approved_by: "operator" }),
			});
			return request<unknown>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	// -------------------------------------------------------------------------
	// Case lifecycle
	// -------------------------------------------------------------------------

	async function listCases(specId?: string): Promise<Result<CaseResponse[]>> {
		try {
			const url = specId
				? `${base}/api/cases?spec_id=${encodeURIComponent(specId)}`
				: `${base}/api/cases`;
			const res = await fetch(url, { headers: authHeaders() });
			return request<CaseResponse[]>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function createCase(specId?: string): Promise<Result<CaseResponse>> {
		try {
			const res = await fetch(`${base}/api/cases`, {
				method: "POST",
				headers: authHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify(specId ? { spec_id: specId } : {}),
			});
			return request<CaseResponse>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function deleteCase(caseId: string): Promise<Result<null>> {
		try {
			const res = await fetch(`${base}/api/cases/${caseId}`, {
				method: "DELETE",
				headers: authHeaders(),
			});
			if (!res.ok) {
				const message = await res.text().catch(() => res.statusText);
				return { data: null, error: { status: res.status, message } };
			}
			return { data: null, error: null };
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function getCase(caseId: string): Promise<Result<CaseResponse>> {
		try {
			const res = await fetch(`${base}/api/cases/${caseId}`, {
				headers: authHeaders(),
			});
			return request<CaseResponse>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function getCaseStatus(caseId: string): Promise<Result<{ state: string }>> {
		try {
			const res = await fetch(`${base}/api/cases/${caseId}/status`, {
				headers: authHeaders(),
			});
			return request<{ state: string }>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	/** Trigger qualification on an extracted case. Pass specId to run a specific spec. */
	async function qualifyCase(caseId: string, specId?: string): Promise<Result<{ workflow_id: string }>> {
		try {
			const url = specId
				? `${base}/api/cases/${caseId}/qualify?spec_id=${encodeURIComponent(specId)}`
				: `${base}/api/cases/${caseId}/qualify`;
			const res = await fetch(url, { method: "POST", headers: authHeaders() });
			return request<{ workflow_id: string }>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	/** Upload one or more PDFs to a case. API expects `files` (plural) field. */
	async function uploadFiles(caseId: string, files: File[]): Promise<Result<unknown>> {
		try {
			const form = new FormData();
			for (const f of files) {
				form.append("files", f);
			}
			const res = await fetch(`${base}/api/cases/${caseId}/files`, {
				method: "POST",
				headers: authHeaders(), // no Content-Type — browser sets multipart boundary
				body: form,
			});
			return request<unknown>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	// -------------------------------------------------------------------------
	// Event streaming
	// -------------------------------------------------------------------------

	/**
	 * Stream case events via fetch (not EventSource — supports auth headers).
	 * Returns a ReadableStreamDefaultReader that yields raw SSE lines.
	 *
	 * Usage:
	 *   const reader = streamEvents(caseId);
	 *   // parse lines: lines starting with "data: " contain JSON CaseEvent
	 */
	function streamEvents(
		caseId: string,
	): { reader: ReadableStreamDefaultReader<Uint8Array>; abort: () => void } {
		const controller = new AbortController();
		const promise = fetch(`${base}/api/cases/${caseId}/events/stream`, {
			headers: authHeaders(),
			signal: controller.signal,
		});

		const stream = new ReadableStream<Uint8Array>({
			async start(ctrl) {
				let res: Response;
				try {
					res = await promise;
				} catch {
					ctrl.close();
					return;
				}
				if (!res.body) { ctrl.close(); return; }
				const reader = res.body.getReader();
				while (true) {
					const { done, value } = await reader.read();
					if (done) { ctrl.close(); break; }
					ctrl.enqueue(value);
				}
			},
		});

		return {
			reader: stream.getReader(),
			abort: () => controller.abort(),
		};
	}

	/**
	 * Stream case events with SSE parsing handled internally.
	 *
	 * Mirrors `generateSpecStream` — callback-based, hides the SSE wire format.
	 * Calls `onEvent` for each parsed CaseEvent. Returns `abort()` to stop the stream.
	 *
	 * Usage:
	 *   const { abort } = client.streamEventsParsed(caseId, (event) => {
	 *     if (event.event_type === "case.system.completed") abort();
	 *   });
	 */
	function streamEventsParsed(
		caseId: string,
		onEvent: (event: CaseEvent) => void,
	): { abort: () => void } {
		const controller = new AbortController();

		(async () => {
			let res: Response;
			try {
				res = await fetch(`${base}/api/cases/${caseId}/events/stream`, {
					headers: authHeaders(),
					signal: controller.signal,
				});
			} catch {
				return;
			}
			if (!res.body) return;

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";
					for (const line of lines) {
						if (!line.startsWith("data: ")) continue;
						const raw = line.slice(6).trim();
						if (!raw || raw === "[DONE]") continue;
						try {
							const event = JSON.parse(raw) as CaseEvent;
							onEvent(event);
						} catch { /* malformed line — skip */ }
					}
				}
			} catch { /* aborted or network error — stop silently */ }
		})();

		return { abort: () => controller.abort() };
	}

	async function getEvents(caseId: string): Promise<Result<CaseEvent[]>> {
		try {
			const res = await fetch(`${base}/api/cases/${caseId}/events`, {
				headers: authHeaders(),
			});
			return request<CaseEvent[]>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	// -------------------------------------------------------------------------
	// Audit
	// -------------------------------------------------------------------------

	async function getAudit(caseId: string): Promise<Result<SpecAuditResponse[]>> {
		try {
			const res = await fetch(`${base}/api/cases/${caseId}/audit`, {
				headers: authHeaders(),
			});
			return request<SpecAuditResponse[]>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	return {
		generateSpec,
		generateSpecStream,
		getSpecDetail,
		listSpecs,
		listCases,
		deleteCase,
		qualifyCase,
		streamEventsParsed,
		createSpec,
		submitSpec,
		approveSpec,
		createCase,
		getCase,
		getCaseStatus,
		uploadFiles,
		streamEvents,
		getEvents,
		getAudit,
	};
}

export type OperatorClient = ReturnType<typeof createOperatorClient>;
