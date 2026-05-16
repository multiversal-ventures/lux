import { normalizeVeritasStatus, normalizeRefinement } from "./normalize.js";
export class APIError extends Error {
    status;
    data;
    constructor(message, status, data) {
        super(message);
        this.name = "APIError";
        this.status = status;
        this.data = data;
    }
}
export function resolveApiPath(baseUrl, path) {
    const trimmed = baseUrl.trim().replace(/\/$/, "");
    const p = path.startsWith("/") ? path : `/${path}`;
    if (!trimmed)
        return p;
    return `${trimmed}${p}`;
}
/**
 * Typed HTTP client for Veritas / Gunnr APIs (Bearer + optional Veritas-Version).
 */
export class VeritasClient {
    cfg;
    constructor(cfg) {
        this.cfg = cfg;
    }
    get baseUrl() {
        return this.cfg.baseUrl;
    }
    resolvePath(path) {
        return resolveApiPath(this.cfg.baseUrl, path);
    }
    async requestJson(path, options = {}) {
        const token = await this.cfg.auth.getToken();
        const headers = {
            "Content-Type": "application/json",
            ...options.headers,
        };
        if (token)
            headers.Authorization = `Bearer ${token}`;
        const v = this.cfg.veritasVersion;
        if (v)
            headers["Veritas-Version"] = v;
        const method = (options.method || "GET").toUpperCase();
        const url = this.resolvePath(path);
        const t0 = typeof performance !== "undefined" ? performance.now() : 0;
        const response = await fetch(url, { ...options, headers });
        const elapsed = typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0;
        if (!response.ok) {
            console.warn(`[VeritasClient] ${method} ${url} → ${response.status} (${elapsed}ms)`);
        }
        else {
            console.debug(`[VeritasClient] ${method} ${url} → ${response.status} (${elapsed}ms)`);
        }
        if (!response.ok) {
            const text = await response.text();
            let errorData;
            try {
                errorData = text ? JSON.parse(text) : {};
            }
            catch {
                errorData = text || {};
            }
            const ed = errorData;
            let errorMessage;
            const detail = ed?.detail;
            if (typeof detail === "object" && detail !== null && "message" in detail) {
                errorMessage = String(detail.message ?? "Error");
            }
            else if (typeof detail === "string") {
                errorMessage = detail;
            }
            else if (typeof ed?.message === "string") {
                errorMessage = ed.message;
            }
            else {
                errorMessage = `API Error: ${response.status}`;
            }
            const structured = typeof detail === "object" && detail !== null ? detail : errorData;
            const error = new APIError(errorMessage, response.status, structured);
            this.cfg.hooks?.onApiError?.({
                error_type: "server",
                error_message: error.message,
                error_code: String(response.status),
                page_url: typeof globalThis !== "undefined" && "location" in globalThis
                    ? globalThis.location.href
                    : undefined,
            });
            throw error;
        }
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
            return (await response.json());
        }
        return (await response.text());
    }
    async uploadMultipart(path, formData, options = {}) {
        const token = await this.cfg.auth.getToken();
        const headers = {
            ...options.headers,
        };
        if (token)
            headers.Authorization = `Bearer ${token}`;
        const v = this.cfg.veritasVersion;
        if (v)
            headers["Veritas-Version"] = v;
        const url = this.resolvePath(path);
        const response = await fetch(url, {
            ...options,
            method: "POST",
            headers,
            body: formData,
        });
        if (!response.ok) {
            const text = await response.text();
            let errorData;
            try {
                errorData = text ? JSON.parse(text) : {};
            }
            catch {
                errorData = text || {};
            }
            const ed = errorData;
            throw new APIError(String(ed?.detail ?? `Upload failed: ${response.status}`), response.status, errorData);
        }
        return (await response.json());
    }
    async getMe() {
        return this.requestJson("/api/auth/me");
    }
    async createTenant(name) {
        return this.requestJson("/api/auth/create-tenant", {
            method: "POST",
            body: JSON.stringify({ name }),
        });
    }
    async createCase(body) {
        return this.requestJson(`/api/cases`, {
            method: "POST",
            body: JSON.stringify(body?.spec_id ? { spec_id: body.spec_id } : {}),
        });
    }
    async getCase(caseId) {
        return this.requestJson(`/api/cases/${caseId}`);
    }
    async listTenantProducts(options) {
        const qs = options?.includeDisabled ? "?include_disabled=true" : "";
        return this.requestJson(`/api/products${qs}`);
    }
    async getSuggestedProducts(caseId) {
        return this.requestJson(`/api/cases/${caseId}/suggested_products`);
    }
    async getCaseFiles(caseId) {
        return this.requestJson(`/api/cases/${caseId}/files`);
    }
    async getCaseDocuments(caseId) {
        return this.requestJson(`/api/cases/${caseId}/documents`);
    }
    async getCaseEntities(caseId) {
        return this.requestJson(`/api/cases/${caseId}/entities`);
    }
    async getCaseExtractions(caseId, docId) {
        const qs = docId ? `?doc_id=${encodeURIComponent(docId)}` : '';
        return this.requestJson(`/api/cases/${caseId}/extractions${qs}`);
    }
    async getCaseExtractionsByDocType(caseId, docType, taxYear) {
        const params = new URLSearchParams({ doc_type: docType });
        if (taxYear != null)
            params.set("tax_year", String(taxYear));
        return this.requestJson(`/api/cases/${caseId}/extractions?${params.toString()}`);
    }
    async uploadCasePdfs(caseId, files) {
        const form = new FormData();
        for (const f of Array.from(files)) {
            form.append("files", f, f.name);
        }
        return this.uploadMultipart(`/api/cases/${caseId}/files`, form);
    }
    async reprocessCase(caseId) {
        return this.requestJson(`/api/cases/${caseId}/reprocess`, { method: "POST" });
    }
    async getCaseBanking(caseId) {
        return this.requestJson(`/api/cases/${caseId}/banking`);
    }
    async getCaseBankingTransactions(caseId) {
        return this.requestJson(`/api/cases/${caseId}/banking/transactions`);
    }
    async getDocumentRegions(caseId, docId) {
        return this.requestJson(`/api/cases/${caseId}/documents/${docId}/transactions`);
    }
    pagePngPath(caseId, fileId, pageNumber) {
        return this.resolvePath(`/api/cases/${caseId}/files/${fileId}/pages/${pageNumber}.png`);
    }
    async fetchBlob(path) {
        const token = await this.cfg.auth.getToken();
        const headers = {};
        if (token)
            headers.Authorization = `Bearer ${token}`;
        const url = this.resolvePath(path);
        const res = await fetch(url, { headers });
        if (!res.ok)
            throw new Error(`${res.status} ${res.statusText}`);
        return res.blob();
    }
    /** Authenticated GET returning a Blob plus filename from Content-Disposition. */
    async fetchAuthorizedBinary(path) {
        const token = await this.cfg.auth.getToken();
        const headers = {};
        if (token)
            headers.Authorization = `Bearer ${token}`;
        const url = this.resolvePath(path);
        const res = await fetch(url, { headers });
        if (!res.ok) {
            const text = await res.text();
            let errorData;
            try {
                errorData = text ? JSON.parse(text) : {};
            }
            catch {
                errorData = text || {};
            }
            const ed = errorData;
            const detail = ed?.detail;
            let errorMessage;
            if (typeof detail === "object" && detail !== null && "message" in detail) {
                errorMessage = String(detail.message ?? "Error");
            }
            else if (typeof detail === "string") {
                errorMessage = detail;
            }
            else if (typeof ed?.message === "string") {
                errorMessage = ed.message;
            }
            else {
                errorMessage = `API Error: ${res.status}`;
            }
            const structured = typeof detail === "object" && detail !== null ? detail : errorData;
            const error = new APIError(errorMessage, res.status, structured);
            this.cfg.hooks?.onApiError?.({
                error_type: "server",
                error_message: error.message,
                error_code: String(res.status),
                page_url: typeof globalThis !== "undefined" && "location" in globalThis
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
                }
                catch {
                    filename = utf8Star[1].trim();
                }
            }
            else if (quoted?.[1]) {
                filename = quoted[1].trim();
            }
            else if (bare?.[1]) {
                filename = bare[1].replace(/^"+|"+$/g, "").trim();
            }
        }
        const blob = await res.blob();
        return { blob, filename };
    }
    async getCaseEvents(caseId) {
        return this.requestJson(`/api/cases/${caseId}/events`);
    }
    /**
     * Open an SSE stream for case events using fetch (supports Authorization header).
     * Returns an abort function. The stream closes automatically when the case reaches
     * a terminal state or the caller invokes abort.
     */
    streamCaseEvents(caseId, onEvent, onError, options) {
        const controller = new AbortController();
        const run = async () => {
            let token = null;
            try {
                token = await this.cfg.auth.getToken();
            }
            catch {
                // no token — proceed unauthenticated (will 401 server-side)
            }
            const headers = {};
            if (token)
                headers.Authorization = `Bearer ${token}`;
            // Pass cursor so the server starts from after the last known event_id.
            // This prevents historical case.system.completed from immediately
            // closing the stream on reconnect after a case has completed extraction.
            const cursor = options?.cursor;
            const streamUrl = cursor != null && cursor > 0
                ? this.resolvePath(`/api/cases/${caseId}/events/stream?cursor=${cursor}`)
                : this.resolvePath(`/api/cases/${caseId}/events/stream`);
            let res;
            try {
                res = await fetch(streamUrl, {
                    headers,
                    signal: controller.signal,
                });
            }
            catch {
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
                    if (done)
                        break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() ?? "";
                    for (const line of lines) {
                        if (!line.startsWith("data: "))
                            continue;
                        const raw = line.slice(6).trim();
                        if (!raw || raw === "[DONE]")
                            continue;
                        try {
                            const event = JSON.parse(raw);
                            onEvent(event);
                        }
                        catch {
                            /* malformed — skip */
                        }
                    }
                }
            }
            catch {
                if (!controller.signal.aborted) {
                    onError?.(new Error("Event stream disconnected"));
                }
            }
        };
        void run();
        return () => controller.abort();
    }
    async listSamples() {
        return this.requestJson("/api/samples");
    }
    async createSampleCase(sampleId) {
        return this.requestJson("/api/samples/create", {
            method: "POST",
            body: JSON.stringify({ sample_id: sampleId }),
        });
    }
    // ─── Scenarios ─────────────────────────────────────────────────────────────
    async getCaseScenarios(caseId) {
        const rows = await this.requestJson(`/api/cases/${encodeURIComponent(caseId)}/scenarios`);
        return (rows ?? []).map((s) => ({ ...s, status: normalizeVeritasStatus(s.status) }));
    }
    // ─── Reports (generated .xlsx) ─────────────────────────────────────────────
    /** GET /api/cases/{case_id}/reports — optional scenario_id scopes last_* metadata. */
    async listReports(caseId, opts) {
        const qs = opts?.scenarioId != null && opts.scenarioId !== ""
            ? `?scenario_id=${encodeURIComponent(opts.scenarioId)}`
            : "";
        return this.requestJson(`/api/cases/${encodeURIComponent(caseId)}/reports${qs}`);
    }
    /** POST /api/cases/{case_id}/reports/{report_name} — 201 with metadata; body optional. */
    async generateReport(caseId, reportName, body) {
        const path = `/api/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(reportName)}`;
        return this.requestJson(path, {
            method: "POST",
            body: JSON.stringify(body ?? {}),
        });
    }
    /** GET /api/cases/{case_id}/reports/{report_name}/latest — requires scenario_id. */
    async getLatestReport(caseId, reportName, opts) {
        const params = new URLSearchParams({ scenario_id: opts.scenarioId });
        if (opts.tenantSlug)
            params.set("tenant_slug", opts.tenantSlug);
        return this.requestJson(`/api/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(reportName)}/latest?${params.toString()}`);
    }
    /** GET binary .xlsx for a persisted report row (report_id from generate or latest). */
    async downloadReport(caseId, reportName, reportId) {
        const path = `/api/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(reportName)}/download?report_id=${encodeURIComponent(reportId)}`;
        return this.fetchAuthorizedBinary(path);
    }
    /** GET /api/cases/{case_id}/audit — full calculation audit (specs, steps, function_calls). */
    async getCaseAudit(caseId) {
        return this.requestJson(`/api/cases/${encodeURIComponent(caseId)}/audit`);
    }
    async getCaseScenario(caseId, scenarioId) {
        const raw = await this.requestJson(`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}`);
        return { ...raw, status: normalizeVeritasStatus(raw.status) };
    }
    async getCaseScenarioSummary(caseId, scenarioId, opts = {}) {
        const qs = opts.refresh ? "?refresh=true" : "";
        return this.requestJson(`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/summary${qs}`);
    }
    async getCaseScenarioRefinementSummary(caseId, scenarioId, refinementId, opts = {}) {
        const qs = opts.refresh ? "?refresh=true" : "";
        return this.requestJson(`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/refinements/${encodeURIComponent(refinementId)}/summary${qs}`);
    }
    async createCaseScenario(caseId, body) {
        return this.requestJson(`/api/cases/${encodeURIComponent(caseId)}/scenarios`, { method: "POST", body: JSON.stringify(body) });
    }
    async startCaseScenario(caseId, scenarioId) {
        return this.requestJson(`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/start`, { method: "POST" });
    }
    async deleteCaseScenario(caseId, scenarioId) {
        return this.requestJson(`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}`, { method: "DELETE" });
    }
    // ─── Refinements ────────────────────────────────────────────────────────────
    async getCaseScenarioRefinements(caseId, scenarioId) {
        const rows = await this.requestJson(`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/refinements`);
        return (rows ?? []).map(normalizeRefinement);
    }
    async getCaseScenarioRefinement(caseId, scenarioId, refinementId) {
        const raw = await this.requestJson(`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/refinements/${encodeURIComponent(refinementId)}`);
        return normalizeRefinement(raw);
    }
    async createCaseScenarioRefinement(caseId, scenarioId, body) {
        return this.requestJson(`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/refinements`, { method: "POST", body: JSON.stringify(body) });
    }
    async startCaseScenarioRefinement(caseId, scenarioId, refinementId) {
        return this.requestJson(`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/refinements/${encodeURIComponent(refinementId)}/start`, { method: "POST" });
    }
    // ─── Audit ──────────────────────────────────────────────────────────────────
    async getAudit(caseId) {
        return this.requestJson(`/api/cases/${encodeURIComponent(caseId)}/audit`);
    }
    async getSpecAudit(caseId, specName) {
        return this.requestJson(`/api/cases/${encodeURIComponent(caseId)}/audit/specs/${encodeURIComponent(specName)}`);
    }
    async getCaseScenarioAdvice(caseId, scenarioId) {
        return this.requestJson(`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/advice`);
    }
    /**
     * Build absolute URL for `EventSource` when `baseUrl` is empty (browser resolves against `location.origin`).
     */
    toAbsoluteUrl(path) {
        const resolved = this.resolvePath(path);
        if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
            return resolved;
        }
        const origin = typeof globalThis !== "undefined" && "location" in globalThis
            ? globalThis.location.origin
            : "http://localhost";
        return new URL(resolved, origin).toString();
    }
}
export function createVeritasClient(cfg) {
    return new VeritasClient(cfg);
}
/** HTTP header name used to authenticate portal API requests. */
const PORTAL_AUTH_HEADER = "X-Portal-Token";
/**
 * Minimal portal session client.
 *
 * Wraps the two portal endpoints (/portal/session and /portal/session/{id}/intents)
 * with typed results so app code doesn't need to hand-roll fetch logic.
 */
export function createPortalClient(config = {}) {
    const base = config.baseUrl ?? "";
    async function fetchSession(token) {
        try {
            const res = await fetch(`${base}/api/portal/session?token=${encodeURIComponent(token)}`, {
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
            const session = await res.json();
            return { session, error: null };
        }
        catch {
            return {
                session: null,
                error: { code: "network", message: "Failed to connect to server" },
            };
        }
    }
    async function submitIntents(sessionId, token, intents) {
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
            const data = await res.json();
            return { session: data.session, error: null };
        }
        catch {
            return { session: null, error: { code: "network", message: "Failed to submit" } };
        }
    }
    return { fetchSession, submitIntents };
}
//# sourceMappingURL=client.js.map