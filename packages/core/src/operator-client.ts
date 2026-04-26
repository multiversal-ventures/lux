/**
 * Operator client — bearer-token authenticated access to Veritas.
 *
 * Covers the full case lifecycle: spec generation, case creation,
 * file upload, event streaming, audit retrieval. All paths include
 * the /api prefix used by the Veritas API router.
 */

import type { components } from "./generated.js";


export type CaseResponse = components["schemas"]["CaseResponse"];
export type SpecAuditResponse = components["schemas"]["SpecAuditResponse"];
export type CalculationStepResponse = components["schemas"]["CalculationStepResponse"];
export type SpecResponse = components["schemas"]["SpecResponse"];
export type DocumentResponse = components["schemas"]["DocumentResponse"];
export type ExtractionResponse = components["schemas"]["ExtractionResponse"];
export type ExtractionSourceResponse = components["schemas"]["ExtractionSourceResponse"];
export type BboxResponse = components["schemas"]["BboxResponse"];

// Banking response shape is pivoted from long-format aggregation rows on
// the backend, so the generated OpenAPI types lag. We declare them
// inline and expose them as the public type surface.
export interface BankingAccount {
	account_id: string | null;
	account_holder_name: string | null;
	currency: string | null;
	gross_deposits_aggressive: number;
	gross_deposits_conservative: number;
	average_monthly_deposits: number;
	months_covered: number | null;
	stream_count: number;
	payroll_stream_confidence: number | null;
	balance_reconciled: boolean | null;
	coverage_passed: boolean | null;
	summary_matched: boolean | null;
	source_doc_ids: string[];
}

export interface BankingBorrowerRollup {
	borrower_id: string | null;
	borrower_name: string | null;
	account_count: number;
	source_account_ids: string[];
	gross_deposits_aggressive: number;
	gross_deposits_conservative: number;
	average_monthly_deposits: number;
	months_covered: number | null;
	stream_count: number;
	payroll_stream_confidence: number | null;
}

export interface BankingResponse {
	accounts: BankingAccount[];
	borrowers: BankingBorrowerRollup[];
	total_gross_deposits: number;
	total_average_monthly: number;
}

export interface TransactionRow {
	row_index: number | null;
	data: Record<string, unknown>;
}

export interface TransactionRegion {
	region_id: string;
	page_number: number | null;
	parquet_path: string;
	columns: string[];
	row_count: number;
	rows: TransactionRow[];
}

export interface TransactionsResponse {
	doc_id: string;
	source_filename: string | null;
	regions: TransactionRegion[];
	total_rows: number;
}

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

// ---------------------------------------------------------------------------
// Module-level SSE helpers (no access to config closure)
// ---------------------------------------------------------------------------

type MetaType = { name: string; domain: string; version: string };

interface SpecStreamState {
	yaml: string;
	meta: MetaType | null;
}

/** Process a single decoded SSE data value for the spec-generation stream. */
function processSpecDataLine(
	decoded: string,
	state: SpecStreamState,
	onChunk: (chunk: string) => void,
): { error?: OperatorClientError } {
	if (decoded.includes("\nMETA:")) {
		const idx = decoded.indexOf("\nMETA:");
		const text = decoded.slice(0, idx);
		const metaJson = decoded.slice(idx + 6);
		if (text) {
			state.yaml += text;
			onChunk(text);
		}
		try {
			state.meta = JSON.parse(metaJson) as MetaType;
		} catch {
			/* skip malformed meta */
		}
	} else if (decoded.startsWith("META:")) {
		try {
			state.meta = JSON.parse(decoded.slice(5)) as MetaType;
		} catch {
			/* skip malformed meta */
		}
	} else if (decoded.startsWith('{"error"')) {
		const err = JSON.parse(decoded) as { error: string };
		return { error: { status: 502, message: err.error } };
	} else {
		state.yaml += decoded;
		onChunk(decoded);
	}
	return {};
}

/** Stream SSE case events from an authenticated URL, calling onEvent per parsed event. */
async function consumeSseEventStream(
	url: string,
	headers: Record<string, string>,
	signal: AbortSignal,
	onEvent: (event: CaseEvent) => void,
	onError?: (err: OperatorClientError) => void,
): Promise<void> {
	let res: Response;
	try {
		res = await fetch(url, { headers, signal });
	} catch {
		if (!signal.aborted) {
			onError?.({ status: 0, message: "Failed to connect to event stream" });
		}
		return;
	}
	if (!res.body) {
		onError?.({ status: res.status, message: "No response body from event stream" });
		return;
	}

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
				} catch {
					/* malformed line — skip */
				}
			}
		}
	} catch {
		if (!signal.aborted) {
			onError?.({ status: 0, message: "Event stream disconnected" });
		}
	}
}

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
			// Each chunk is JSON-encoded: "data: \"token text\""
			// META chunk: "data: \"\\nMETA:{...}\""
			const state: SpecStreamState = { yaml: "", meta: null };

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const blocks = buffer.split("\n\n");
				buffer = blocks.pop() ?? "";
				for (const block of blocks) {
					for (const line of block.split("\n")) {
						if (!line.startsWith("data: ")) continue;
						const raw = line.slice(6).trim();
						if (!raw) continue;
						let decoded: string;
						try {
							decoded = JSON.parse(raw) as string;
						} catch {
							decoded = raw;
						}
						const { error } = processSpecDataLine(decoded, state, onChunk);
						if (error) return { data: null, error };
					}
				}
			}

			if (!state.meta) return { data: null, error: { status: 500, message: "No metadata in stream" } };
			const { name, domain, version } = state.meta;
			return { data: { yaml: state.yaml, name, domain, version }, error: null };
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
			return await request<GenerateSpecResult>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function getSpecDetail(specId: string): Promise<Result<SpecResponse & { yaml_content?: string | null }>> {
		try {
			const res = await fetch(`${base}/api/specs/${specId}`, { headers: authHeaders() });
			return await request<SpecResponse & { yaml_content?: string | null }>(res);
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
			return await request<SpecResponse[]>(res);
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
			return await request<{ spec_id: string }>(res);
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
			return await request<unknown>(res);
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
			return await request<unknown>(res);
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
			return await request<CaseResponse[]>(res);
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
			return await request<CaseResponse>(res);
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
			return await request<CaseResponse>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function getCaseStatus(caseId: string): Promise<Result<{ state: string }>> {
		try {
			const res = await fetch(`${base}/api/cases/${caseId}/status`, {
				headers: authHeaders(),
			});
			return await request<{ state: string }>(res);
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
			return await request<{ workflow_id: string }>(res);
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
			return await request<unknown>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	// -------------------------------------------------------------------------
	// Event streaming
	// -------------------------------------------------------------------------

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
		onError?: (err: OperatorClientError) => void,
	): { abort: () => void } {
		const controller = new AbortController();
		const url = `${base}/api/cases/${caseId}/events/stream`;
		void consumeSseEventStream(url, authHeaders(), controller.signal, onEvent, onError);
		return { abort: () => controller.abort() };
	}

	async function getEvents(caseId: string): Promise<Result<CaseEvent[]>> {
		try {
			const res = await fetch(`${base}/api/cases/${caseId}/events`, {
				headers: authHeaders(),
			});
			return await request<CaseEvent[]>(res);
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
			return await request<SpecAuditResponse[]>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	// -------------------------------------------------------------------------
	// Case documents / extractions / banking
	// -------------------------------------------------------------------------

	async function listDocuments(
		caseId: string,
	): Promise<Result<DocumentResponse[]>> {
		try {
			const res = await fetch(`${base}/api/cases/${caseId}/documents`, {
				headers: authHeaders(),
			});
			return await request<DocumentResponse[]>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function listExtractions(
		caseId: string,
		opts?: { docId?: string },
	): Promise<Result<ExtractionResponse[]>> {
		try {
			const url = opts?.docId
				? `${base}/api/cases/${caseId}/extractions?doc_id=${encodeURIComponent(opts.docId)}`
				: `${base}/api/cases/${caseId}/extractions`;
			const res = await fetch(url, { headers: authHeaders() });
			return await request<ExtractionResponse[]>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function getBanking(
		caseId: string,
	): Promise<Result<BankingResponse>> {
		try {
			const res = await fetch(`${base}/api/cases/${caseId}/banking`, {
				headers: authHeaders(),
			});
			return await request<BankingResponse>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function listTransactions(
		caseId: string,
		docId: string,
	): Promise<Result<TransactionsResponse>> {
		try {
			const res = await fetch(
				`${base}/api/cases/${caseId}/documents/${docId}/transactions`,
				{ headers: authHeaders() },
			);
			return await request<TransactionsResponse>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	/** Build the page PNG URL for a (case, file, page) triple. Does NOT fetch.
	 *
	 * Consumers that need the bytes (e.g. <img>) must fetch with
	 * Authorization: Bearer ... themselves. In lux-react this is done by
	 * <AuthedImage>.
	 */
	function pagePngUrl(
		caseId: string,
		fileId: string,
		pageNumber: number,
	): string {
		return `${base}/api/cases/${caseId}/files/${fileId}/pages/${pageNumber}.png`;
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
		getEvents,
		getAudit,
		listDocuments,
		listExtractions,
		getBanking,
		listTransactions,
		pagePngUrl,
	};
}

export type OperatorClient = ReturnType<typeof createOperatorClient>;
