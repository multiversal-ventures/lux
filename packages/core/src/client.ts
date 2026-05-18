import type { AuthProvider } from "./auth.js";
import type { components } from "./generated.js";
import { normalizeVeritasStatus, normalizeRefinement, type NormalizedRefinement } from "./normalize.js";

// ─────────────────────────────────────────────────────────────────────────────
// VeritasClient — typed HTTP client for Veritas / dashboard-style apps
// (Bearer tokens, optional Veritas-Version header, error hooks).
// ─────────────────────────────────────────────────────────────────────────────

export interface MeResponse {
	user_id: string;
	email: string | null;
	display_name: string | null;
	caller_type: string;
	tenant_id: string | null;
	has_tenant: boolean;
	role: string | null;
	permissions: string[];
}

export interface CreateTenantResponse {
	tenant_id: string;
	tenant_name: string;
	role: string;
	has_tenant: boolean;
}

export interface VeritasCaseFile {
	file_id: string;
	original_filename: string | null;
	uploaded_at: string | null;
	total_pages: number;
}

export interface VeritasCaseDocument {
	doc_id: string;
	doc_type: string | null;
	original_filename: string | null;
	file_id: string;
	page_numbers: number[] | null;
	effective_period_start: string | null;
	effective_period_end: string | null;
	tax_year: number | null;
}

/**
 * Relationship between two identity clusters.
 * Manually typed — Veritas OpenAPI doesn't yet export RelationshipInfo.
 */
export interface RelationshipInfo {
	relationship_id: string;
	source: { id: string; kind: "person" | "entity" };
	target: { id: string; kind: "person" | "entity" };
	type: string;
	ownership_pct: number | null;
	effective_period: string | null;
	is_primary: boolean;
}

/** Entity group returned by GET /api/cases/{case_id}/entities */
export interface VeritasEntityGroup {
	entity_group_id: string;
	case_id: string;
	entity_type: string;
	identifier_type: string;
	identifier_value: string;
	label: string;
	resolution_method: string;
	status: string;
	doc_ids: string[];
	parent_entity_group_id: string | null;
	borrower_identity_id: string | null;
}

export interface VeritasCaseEvent {
	event_id: number;
	event_type: string;
	event_data: Record<string, unknown>;
	created_at: string | null;
}

export interface VeritasCaseDetail {
	case_id: string;
	tenant_id: string;
	spec_id: string | null;
	state: string;
	pool_version: number;
	created_at: string | null;
	file_count?: number;
	primary_borrower?: string | null;
}

export interface SampleFileInfo {
	filename: string;
}

export interface SampleInfo {
	id: string;
	name: string;
	description: string;
	category: string;
	files: SampleFileInfo[];
}

export interface SampleListResponse {
	samples: SampleInfo[];
}

export interface CreateSampleCaseResponse {
	case_id: string;
	state: string;
	file_count: number;
	sample_id: string;
}

export type ClientHooks = {
	onApiError?: (info: {
		error_type: string;
		error_message: string;
		error_code: string;
		page_url?: string;
		user_id?: string;
	}) => void;
};

export type VeritasClientConfig = {
	/** Optional API origin (no trailing slash). Empty = same-origin relative paths. */
	baseUrl: string;
	auth: AuthProvider;
	/** Sent as `Veritas-Version` when set. */
	veritasVersion?: string;
	hooks?: ClientHooks;
};

export class APIError extends Error {
	status: number;
	data?: unknown;

	constructor(message: string, status: number, data?: unknown) {
		super(message);
		this.name = "APIError";
		this.status = status;
		this.data = data;
	}
}

export function resolveApiPath(baseUrl: string, path: string): string {
	const trimmed = baseUrl.trim().replace(/\/$/, "");
	const p = path.startsWith("/") ? path : `/${path}`;
	if (!trimmed) return p;
	return `${trimmed}${p}`;
}

/**
 * Typed HTTP client for Veritas / Gunnr APIs (Bearer + optional Veritas-Version).
 */
export class VeritasClient {
	constructor(private readonly cfg: VeritasClientConfig) {}

	get baseUrl(): string {
		return this.cfg.baseUrl;
	}

	resolvePath(path: string): string {
		return resolveApiPath(this.cfg.baseUrl, path);
	}

	async requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
		const token = await this.cfg.auth.getToken();
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...(options.headers as Record<string, string>),
		};
		if (token) headers.Authorization = `Bearer ${token}`;
		const v = this.cfg.veritasVersion;
		if (v) headers["Veritas-Version"] = v;

		const method = (options.method || "GET").toUpperCase();
		const url = this.resolvePath(path);
		const t0 = typeof performance !== "undefined" ? performance.now() : 0;
		const response = await fetch(url, { ...options, headers });
		const elapsed = typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0;

		if (!response.ok) {
			console.warn(`[VeritasClient] ${method} ${url} → ${response.status} (${elapsed}ms)`);
		} else {
			console.debug(`[VeritasClient] ${method} ${url} → ${response.status} (${elapsed}ms)`);
		}

		if (!response.ok) {
			const text = await response.text();
			let errorData: unknown;
			try {
				errorData = text ? JSON.parse(text) : {};
			} catch {
				errorData = text || {};
			}
			const ed = errorData as Record<string, unknown>;
			let errorMessage: string;
			const detail = ed?.detail;
			if (typeof detail === "object" && detail !== null && "message" in detail) {
				errorMessage = String((detail as { message?: unknown }).message ?? "Error");
			} else if (typeof detail === "string") {
				errorMessage = detail;
			} else if (typeof ed?.message === "string") {
				errorMessage = ed.message;
			} else {
				errorMessage = `API Error: ${response.status}`;
			}
			const structured = typeof detail === "object" && detail !== null ? detail : errorData;
			const error = new APIError(errorMessage, response.status, structured);
			this.cfg.hooks?.onApiError?.({
				error_type: "server",
				error_message: error.message,
				error_code: String(response.status),
				page_url:
					typeof globalThis !== "undefined" && "location" in globalThis
						? globalThis.location.href
						: undefined,
			});
			throw error;
		}

		const contentType = response.headers.get("content-type");
		if (contentType?.includes("application/json")) {
			return (await response.json()) as T;
		}
		return (await response.text()) as T;
	}

	async uploadMultipart<T>(
		path: string,
		formData: FormData,
		options: RequestInit = {},
	): Promise<T> {
		const token = await this.cfg.auth.getToken();
		const headers: Record<string, string> = {
			...(options.headers as Record<string, string>),
		};
		if (token) headers.Authorization = `Bearer ${token}`;
		const v = this.cfg.veritasVersion;
		if (v) headers["Veritas-Version"] = v;

		const url = this.resolvePath(path);
		const response = await fetch(url, {
			...options,
			method: "POST",
			headers,
			body: formData,
		});

		if (!response.ok) {
			const text = await response.text();
			let errorData: unknown;
			try {
				errorData = text ? JSON.parse(text) : {};
			} catch {
				errorData = text || {};
			}
			const ed = errorData as Record<string, unknown>;
			throw new APIError(
				String(ed?.detail ?? `Upload failed: ${response.status}`),
				response.status,
				errorData,
			);
		}
		return (await response.json()) as T;
	}

	async getMe(): Promise<MeResponse> {
		return this.requestJson<MeResponse>("/api/auth/me");
	}

	async createTenant(name: string): Promise<CreateTenantResponse> {
		return this.requestJson<CreateTenantResponse>("/api/auth/create-tenant", {
			method: "POST",
			body: JSON.stringify({ name }),
		});
	}

	async createCase(body?: { spec_id?: string | null }): Promise<{ case_id: string; spec_id: string | null }> {
		return this.requestJson(`/api/cases`, {
			method: "POST",
			body: JSON.stringify(body?.spec_id ? { spec_id: body.spec_id } : {}),
		});
	}

	async getCase(caseId: string): Promise<VeritasCaseDetail> {
		return this.requestJson<VeritasCaseDetail>(`/api/cases/${caseId}`);
	}

	async listTenantProducts(options?: { includeDisabled?: boolean }): Promise<components["schemas"]["ProductResponse"][]> {
		const qs = options?.includeDisabled ? "?include_disabled=true" : "";
		return this.requestJson<components["schemas"]["ProductResponse"][]>(`/api/products${qs}`);
	}

	async getSuggestedProducts(caseId: string): Promise<components["schemas"]["SuggestedProductsResponse"]> {
		return this.requestJson<components["schemas"]["SuggestedProductsResponse"]>(
			`/api/cases/${caseId}/suggested_products`,
		);
	}

	async getCaseFiles(caseId: string): Promise<VeritasCaseFile[]> {
		return this.requestJson<VeritasCaseFile[]>(`/api/cases/${caseId}/files`);
	}

	async getCaseDocuments(caseId: string): Promise<VeritasCaseDocument[]> {
		return this.requestJson<VeritasCaseDocument[]>(`/api/cases/${caseId}/documents`);
	}

	/**
	 * Unified identity list: persons, entities, and financial institutions.
	 * Replaces getCaseEntities which only returned entity groups.
	 */
	async getCaseIdentities(
		caseId: string,
	): Promise<components["schemas"]["IdentityInfo"][]> {
		return this.requestJson<components["schemas"]["IdentityInfo"][]>(
			`/api/cases/${encodeURIComponent(caseId)}/identities`,
		);
	}

	async getCaseRelationships(
		caseId: string,
	): Promise<RelationshipInfo[]> {
		return this.requestJson<RelationshipInfo[]>(
			`/api/cases/${encodeURIComponent(caseId)}/relationships`,
		);
	}

	/** @deprecated Use getCaseIdentities instead. Kept one release for backward compat. */
	async getCaseEntities(caseId: string): Promise<VeritasEntityGroup[]> {
		const all = await this.getCaseIdentities(caseId);
		return all
			.filter((i) => (i as { kind?: string }).kind === "entity")
			.map((i) => ({
				entity_group_id: i.id,
				case_id: caseId,
				entity_type: i.entity_type ?? "unknown",
				identifier_type: "",
				identifier_value: "",
				label: i.name ?? "",
				resolution_method: "auto",
				status: i.status,
				doc_ids: [],
				parent_entity_group_id: null,
				borrower_identity_id: null,
			}));
	}

	async getCaseExtractions(caseId: string, docId?: string): Promise<components["schemas"]["ExtractionResponse"][]> {
		const qs = docId ? `?doc_id=${encodeURIComponent(docId)}` : '';
		return this.requestJson<components["schemas"]["ExtractionResponse"][]>(`/api/cases/${caseId}/extractions${qs}`);
	}

	async getCaseExtractionsByDocType(
		caseId: string,
		docType: string,
		taxYear?: number | null,
	): Promise<components["schemas"]["ExtractionResponse"][]> {
		const params = new URLSearchParams({ doc_type: docType });
		if (taxYear != null) params.set("tax_year", String(taxYear));
		return this.requestJson<components["schemas"]["ExtractionResponse"][]>(
			`/api/cases/${caseId}/extractions?${params.toString()}`,
		);
	}

	async uploadCasePdfs(
		caseId: string,
		files: File[] | FileList,
	): Promise<{ case_id: string; workflow_id: string; files_queued: number; status: string }> {
		const form = new FormData();
		for (const f of Array.from(files)) {
			form.append("files", f, f.name);
		}
		return this.uploadMultipart(`/api/cases/${caseId}/files`, form);
	}

	async reprocessCase(caseId: string): Promise<{ case_id: string; workflow_id: string; page_count: number; status: string }> {
		return this.requestJson(`/api/cases/${caseId}/reprocess`, { method: "POST" });
	}

	async getCaseBanking(caseId: string): Promise<import('./operator-types.js').BankingResponse> {
		return this.requestJson(`/api/cases/${caseId}/banking`);
	}

	async getCaseBankingTransactions(caseId: string): Promise<import('./operator-types.js').ClassifiedTransactionsResponse> {
		return this.requestJson(`/api/cases/${caseId}/banking/transactions`);
	}

	async getDocumentRegions(caseId: string, docId: string): Promise<import('./operator-types.js').TransactionsResponse> {
		return this.requestJson(`/api/cases/${caseId}/documents/${docId}/transactions`);
	}

	pagePngPath(caseId: string, fileId: string, pageNumber: number): string {
		return this.resolvePath(`/api/cases/${caseId}/files/${fileId}/pages/${pageNumber}.png`);
	}

	async fetchBlob(path: string): Promise<Blob> {
		const token = await this.cfg.auth.getToken();
		const headers: Record<string, string> = {};
		if (token) headers.Authorization = `Bearer ${token}`;
		const url = this.resolvePath(path);
		const res = await fetch(url, { headers });
		if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
		return res.blob();
	}

	/** Authenticated GET returning a Blob plus filename from Content-Disposition. */
	async fetchAuthorizedBinary(path: string): Promise<{ blob: Blob; filename: string }> {
		const token = await this.cfg.auth.getToken();
		const headers: Record<string, string> = {};
		if (token) headers.Authorization = `Bearer ${token}`;
		const url = this.resolvePath(path);
		const res = await fetch(url, { headers });

		if (!res.ok) {
			const text = await res.text();
			let errorData: unknown;
			try {
				errorData = text ? JSON.parse(text) : {};
			} catch {
				errorData = text || {};
			}
			const ed = errorData as Record<string, unknown>;
			const detail = ed?.detail;
			let errorMessage: string;
			if (typeof detail === "object" && detail !== null && "message" in detail) {
				errorMessage = String((detail as { message?: unknown }).message ?? "Error");
			} else if (typeof detail === "string") {
				errorMessage = detail;
			} else if (typeof ed?.message === "string") {
				errorMessage = ed.message;
			} else {
				errorMessage = `API Error: ${res.status}`;
			}
			const structured = typeof detail === "object" && detail !== null ? detail : errorData;
			const error = new APIError(errorMessage, res.status, structured);
			this.cfg.hooks?.onApiError?.({
				error_type: "server",
				error_message: error.message,
				error_code: String(res.status),
				page_url:
					typeof globalThis !== "undefined" && "location" in globalThis
						? globalThis.location.href
						: undefined,
			});
			throw error;
		}

		const cd = res.headers.get("Content-Disposition");
		let filename = "export.xlsx";
		if (cd) {
			const utf8Star = cd.match(/filename\*=UTF-8''([^;\s]+)/i);
			const quoted = cd.match(/filename="([^"]+)"/i);
			const bare = cd.match(/filename=([^;\s]+)/i);
			if (utf8Star?.[1]) {
				try {
					filename = decodeURIComponent(utf8Star[1].trim());
				} catch {
					filename = utf8Star[1].trim();
				}
			} else if (quoted?.[1]) {
				filename = quoted[1].trim();
			} else if (bare?.[1]) {
				filename = bare[1].replace(/^"+|"+$/g, "").trim();
			}
		}

		const blob = await res.blob();
		return { blob, filename };
	}

	async getCaseEvents(caseId: string): Promise<VeritasCaseEvent[]> {
		return this.requestJson<VeritasCaseEvent[]>(`/api/cases/${caseId}/events`);
	}

	/**
	 * Open an SSE stream for case events using fetch (supports Authorization header).
	 * Returns an abort function. The stream closes automatically when the case reaches
	 * a terminal state or the caller invokes abort.
	 */
	streamCaseEvents(
		caseId: string,
		onEvent: (event: VeritasCaseEvent) => void,
		onError?: (err: Error) => void,
		options?: { cursor?: number },
	): () => void {
		const controller = new AbortController();

		const run = async () => {
			let token: string | null = null;
			try {
				token = await this.cfg.auth.getToken();
			} catch {
				// no token — proceed unauthenticated (will 401 server-side)
			}
			const headers: Record<string, string> = {};
			if (token) headers.Authorization = `Bearer ${token}`;

			// Pass cursor so the server starts from after the last known event_id.
			// This prevents historical case.system.completed from immediately
			// closing the stream on reconnect after a case has completed extraction.
			const cursor = options?.cursor;
			const streamUrl = cursor != null && cursor > 0
				? this.resolvePath(`/api/cases/${caseId}/events/stream?cursor=${cursor}`)
				: this.resolvePath(`/api/cases/${caseId}/events/stream`);

			let res: Response;
			try {
				res = await fetch(streamUrl, {
					headers,
					signal: controller.signal,
				});
			} catch {
				if (!controller.signal.aborted) {
					onError?.(new Error("Failed to connect to event stream"));
				}
				return;
			}

			if (!res.body) {
				onError?.(new Error("No response body from event stream"));
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
							const event = JSON.parse(raw) as VeritasCaseEvent;
							onEvent(event);
						} catch {
							/* malformed — skip */
						}
					}
				}
			} catch {
				if (!controller.signal.aborted) {
					onError?.(new Error("Event stream disconnected"));
				}
			}
		};

		void run();
		return () => controller.abort();
	}

	async listSamples(): Promise<SampleListResponse> {
		return this.requestJson<SampleListResponse>("/api/samples");
	}

	async createSampleCase(sampleId: string): Promise<CreateSampleCaseResponse> {
		return this.requestJson<CreateSampleCaseResponse>("/api/samples/create", {
			method: "POST",
			body: JSON.stringify({ sample_id: sampleId }),
		});
	}

	// ─── Scenarios ─────────────────────────────────────────────────────────────

	async getCaseScenarios(caseId: string): Promise<components["schemas"]["ScenarioComparisonResponse"][]> {
		const rows = await this.requestJson<components["schemas"]["ScenarioComparisonResponse"][]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios`,
		);
		return (rows ?? []).map((s) => ({ ...s, status: normalizeVeritasStatus(s.status) }));
	}

	// ─── Reports (generated .xlsx) ─────────────────────────────────────────────

	/** GET /api/cases/{case_id}/reports — optional scenario_id scopes last_* metadata. */
	async listReports(
		caseId: string,
		opts?: { scenarioId?: string },
	): Promise<components["schemas"]["ReportListItem"][]> {
		const qs =
			opts?.scenarioId != null && opts.scenarioId !== ""
				? `?scenario_id=${encodeURIComponent(opts.scenarioId)}`
				: "";
		return this.requestJson<components["schemas"]["ReportListItem"][]>(
			`/api/cases/${encodeURIComponent(caseId)}/reports${qs}`,
		);
	}

	/** POST /api/cases/{case_id}/reports/{report_name} — 201 with metadata; body optional. */
	async generateReport(
		caseId: string,
		reportName: string,
		body?: components["schemas"]["ReportGenerateRequest"] | null,
	): Promise<components["schemas"]["ReportGenerateResponse"]> {
		const path = `/api/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(reportName)}`;
		return this.requestJson<components["schemas"]["ReportGenerateResponse"]>(path, {
			method: "POST",
			body: JSON.stringify(body ?? {}),
		});
	}

	/** GET /api/cases/{case_id}/reports/{report_name}/latest — requires scenario_id. */
	async getLatestReport(
		caseId: string,
		reportName: string,
		opts: { scenarioId: string; tenantSlug?: string | null },
	): Promise<components["schemas"]["ReportGenerateResponse"]> {
		const params = new URLSearchParams({ scenario_id: opts.scenarioId });
		if (opts.tenantSlug) params.set("tenant_slug", opts.tenantSlug);
		return this.requestJson<components["schemas"]["ReportGenerateResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(reportName)}/latest?${params.toString()}`,
		);
	}

	/** GET binary .xlsx for a persisted report row (report_id from generate or latest). */
	async downloadReport(
		caseId: string,
		reportName: string,
		reportId: string,
	): Promise<{ blob: Blob; filename: string }> {
		const path = `/api/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(reportName)}/download?report_id=${encodeURIComponent(reportId)}`;
		return this.fetchAuthorizedBinary(path);
	}

	/** GET /api/cases/{case_id}/audit — full calculation audit (specs, steps, function_calls). */
	async getCaseAudit(caseId: string): Promise<components["schemas"]["SpecAuditResponse"][]> {
		return this.requestJson<components["schemas"]["SpecAuditResponse"][]>(
			`/api/cases/${encodeURIComponent(caseId)}/audit`,
		);
	}

	async getCaseScenario(
		caseId: string,
		scenarioId: string,
	): Promise<components["schemas"]["ScenarioDetailResponse"]> {
		const raw = await this.requestJson<components["schemas"]["ScenarioDetailResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}`,
		);
		return { ...raw, status: normalizeVeritasStatus(raw.status) };
	}

	async getCaseScenarioSummary(
		caseId: string,
		scenarioId: string,
		opts: { refresh?: boolean } = {},
	): Promise<components["schemas"]["ScenarioSummaryResponse"]> {
		const qs = opts.refresh ? "?refresh=true" : "";
		return this.requestJson<components["schemas"]["ScenarioSummaryResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/summary${qs}`,
		);
	}

	async getCaseScenarioRefinementSummary(
		caseId: string,
		scenarioId: string,
		refinementId: string,
		opts: { refresh?: boolean } = {},
	): Promise<components["schemas"]["ScenarioSummaryResponse"]> {
		const qs = opts.refresh ? "?refresh=true" : "";
		return this.requestJson<components["schemas"]["ScenarioSummaryResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/refinements/${encodeURIComponent(refinementId)}/summary${qs}`,
		);
	}

	async createCaseScenario(
		caseId: string,
		body: components["schemas"]["CreateScenarioRequest"],
	): Promise<components["schemas"]["CreateScenarioResponse"]> {
		return this.requestJson<components["schemas"]["CreateScenarioResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios`,
			{ method: "POST", body: JSON.stringify(body) },
		);
	}

	async startCaseScenario(
		caseId: string,
		scenarioId: string,
	): Promise<components["schemas"]["StartScenarioResponse"]> {
		return this.requestJson<components["schemas"]["StartScenarioResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/start`,
			{ method: "POST" },
		);
	}

	async deleteCaseScenario(
		caseId: string,
		scenarioId: string,
	): Promise<components["schemas"]["DeleteScenarioResponse"]> {
		return this.requestJson<components["schemas"]["DeleteScenarioResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}`,
			{ method: "DELETE" },
		);
	}

	// ─── Refinements ────────────────────────────────────────────────────────────

	async getCaseScenarioRefinements(caseId: string, scenarioId: string): Promise<NormalizedRefinement[]> {
		const rows = await this.requestJson<components["schemas"]["RefinementResponse"][]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/refinements`,
		);
		return (rows ?? []).map(normalizeRefinement);
	}

	async getCaseScenarioRefinement(
		caseId: string,
		scenarioId: string,
		refinementId: string,
	): Promise<NormalizedRefinement> {
		const raw = await this.requestJson<components["schemas"]["RefinementResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/refinements/${encodeURIComponent(refinementId)}`,
		);
		return normalizeRefinement(raw);
	}

	async createCaseScenarioRefinement(
		caseId: string,
		scenarioId: string,
		body: components["schemas"]["CreateRefinementRequest"],
	): Promise<components["schemas"]["CreateRefinementResponse"]> {
		return this.requestJson<components["schemas"]["CreateRefinementResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/refinements`,
			{ method: "POST", body: JSON.stringify(body) },
		);
	}

	async startCaseScenarioRefinement(
		caseId: string,
		scenarioId: string,
		refinementId: string,
	): Promise<components["schemas"]["StartRefinementResponse"]> {
		return this.requestJson<components["schemas"]["StartRefinementResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/refinements/${encodeURIComponent(refinementId)}/start`,
			{ method: "POST" },
		);
	}

	// ─── Audit ──────────────────────────────────────────────────────────────────

	async getAudit(caseId: string): Promise<components["schemas"]["SpecAuditResponse"][]> {
		return this.requestJson<components["schemas"]["SpecAuditResponse"][]>(
			`/api/cases/${encodeURIComponent(caseId)}/audit`,
		);
	}

	async getSpecAudit(caseId: string, specName: string): Promise<components["schemas"]["SpecAuditResponse"]> {
		return this.requestJson<components["schemas"]["SpecAuditResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/audit/specs/${encodeURIComponent(specName)}`,
		);
	}

	async getCaseScenarioAdvice(caseId: string, scenarioId: string): Promise<components["schemas"]["ScenarioAdviceResponse"]> {
		return this.requestJson<components["schemas"]["ScenarioAdviceResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/advice`,
		);
	}

	/**
	 * Build absolute URL for `EventSource` when `baseUrl` is empty (browser resolves against `location.origin`).
	 */
	toAbsoluteUrl(path: string): string {
		const resolved = this.resolvePath(path);
		if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
			return resolved;
		}
		const origin =
			typeof globalThis !== "undefined" && "location" in globalThis
				? (globalThis as unknown as { location: { origin: string } }).location.origin
				: "http://localhost";
		return new URL(resolved, origin).toString();
	}
}

export function createVeritasClient(cfg: VeritasClientConfig): VeritasClient {
	return new VeritasClient(cfg);
}

// ─────────────────────────────────────────────────────────────────────────────
// PortalClient — minimal session client for the borrower portal
// (X-Portal-Token header, /portal/session + /portal/session/:id/intents).
// ─────────────────────────────────────────────────────────────────────────────

type PortalSession = components["schemas"]["PortalSessionResponse"];
type Intent = components["schemas"]["Intent"];

/** HTTP header name used to authenticate portal API requests. */
const PORTAL_AUTH_HEADER = "X-Portal-Token" as const;

export interface PortalClientConfig {
	/** Base URL of the Veritas API (e.g. "" for same-origin, "https://api.example.com" for external). */
	baseUrl?: string;
}

export interface PortalClientError {
	code: "expired" | "no_token" | "network" | "server" | "not_ready";
	message: string;
	status?: number;
}

/** Discriminated union: exactly one of session or error is set. */
export type FetchSessionResult =
	| { session: PortalSession; error: null }
	| { session: null; error: PortalClientError };

/** Discriminated union: exactly one of session or error is set. */
export type SubmitIntentsResult =
	| { session: PortalSession; error: null }
	| { session: null; error: PortalClientError };

/**
 * Minimal portal session client.
 *
 * Wraps the two portal endpoints (/portal/session and /portal/session/{id}/intents)
 * with typed results so app code doesn't need to hand-roll fetch logic.
 */
export function createPortalClient(config: PortalClientConfig = {}) {
	const base = config.baseUrl ?? "";

	async function fetchSession(token: string): Promise<FetchSessionResult> {
		try {
		// Token in X-Portal-Token header only — never in URL query param.
		// URL query params appear in server access logs and browser history;
		// the header path keeps the token out of both.
		const res = await fetch(`${base}/api/portal/session`, {
			headers: { [PORTAL_AUTH_HEADER]: token },
		});
			if (!res.ok) {
				if (res.status === 401) {
					return {
						session: null,
						error: {
							code: "expired",
							message: "Session has expired. Please request a new link.",
							status: 401,
						},
					};
				}
				return {
					session: null,
					error: {
						code: "server",
						message: `Failed to load session (${res.status})`,
						status: res.status,
					},
				};
			}
			const session: PortalSession = await res.json();
			return { session, error: null };
		} catch {
			return {
				session: null,
				error: { code: "network", message: "Failed to connect to server" },
			};
		}
	}

	async function submitIntents(
		sessionId: string,
		token: string,
		intents: Intent[],
	): Promise<SubmitIntentsResult> {
		try {
			const res = await fetch(`${base}/api/portal/session/${sessionId}/intents`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					[PORTAL_AUTH_HEADER]: token,
				},
				body: JSON.stringify({ intents }),
			});
			if (!res.ok) {
				return {
					session: null,
					error: {
						code: "server",
						message: `Failed to submit (${res.status})`,
						status: res.status,
					},
				};
			}
			const data: { session: PortalSession } = await res.json();
			return { session: data.session, error: null };
		} catch {
			return { session: null, error: { code: "network", message: "Failed to submit" } };
		}
	}

	return { fetchSession, submitIntents };
}
