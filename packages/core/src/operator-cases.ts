import type {
	BankingResponse,
	CaseEvent,
	CaseResponse,
	DocumentResponse,
	ExtractionResponse,
	OperatorClientError,
	Result,
	SpecAuditResponse,
	TransactionsResponse,
} from "./operator-types.js";

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

/**
 * Create case-lifecycle, event-streaming, audit, and document methods
 * bound to a shared request context.
 * Returned object is spread into the OperatorClient return value.
 */
export function createCaseMethods(
	base: string,
	authHeaders: (extra?: Record<string, string>) => Record<string, string>,
	request: <T>(res: Response) => Promise<Result<T>>,
) {
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
			const res = await fetch(`${base}/api/cases/${caseId}`, { headers: authHeaders() });
			return await request<CaseResponse>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function getCaseStatus(caseId: string): Promise<Result<{ state: string }>> {
		try {
			const res = await fetch(`${base}/api/cases/${caseId}/status`, { headers: authHeaders() });
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

	/**
	 * Stream case events with SSE parsing handled internally.
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
			const res = await fetch(`${base}/api/cases/${caseId}/events`, { headers: authHeaders() });
			return await request<CaseEvent[]>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function getAudit(caseId: string): Promise<Result<SpecAuditResponse[]>> {
		try {
			const res = await fetch(`${base}/api/cases/${caseId}/audit`, { headers: authHeaders() });
			return await request<SpecAuditResponse[]>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function listDocuments(caseId: string): Promise<Result<DocumentResponse[]>> {
		try {
			const res = await fetch(`${base}/api/cases/${caseId}/documents`, { headers: authHeaders() });
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

	async function getBanking(caseId: string): Promise<Result<BankingResponse>> {
		try {
			const res = await fetch(`${base}/api/cases/${caseId}/banking`, { headers: authHeaders() });
			return await request<BankingResponse>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function listTransactions(caseId: string, docId: string): Promise<Result<TransactionsResponse>> {
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

	/** Build the page PNG URL for a (case, file, page) triple. Does NOT fetch. */
	function pagePngUrl(caseId: string, fileId: string, pageNumber: number): string {
		return `${base}/api/cases/${caseId}/files/${fileId}/pages/${pageNumber}.png`;
	}

	return {
		listCases,
		createCase,
		deleteCase,
		getCase,
		getCaseStatus,
		qualifyCase,
		uploadFiles,
		streamEventsParsed,
		getEvents,
		getAudit,
		listDocuments,
		listExtractions,
		getBanking,
		listTransactions,
		pagePngUrl,
	};
}
