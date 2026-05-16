/** Stream SSE case events from an authenticated URL, calling onEvent per parsed event. */
async function consumeSseEventStream(url, headers, signal, onEvent, onError) {
    let res;
    try {
        res = await fetch(url, { headers, signal });
    }
    catch {
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
                    /* malformed line — skip */
                }
            }
        }
    }
    catch {
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
export function createCaseMethods(base, authHeaders, request) {
    async function listCases(specId) {
        try {
            const url = specId
                ? `${base}/api/cases?spec_id=${encodeURIComponent(specId)}`
                : `${base}/api/cases`;
            const res = await fetch(url, { headers: authHeaders() });
            return await request(res);
        }
        catch {
            return { data: null, error: { status: 0, message: "Network error" } };
        }
    }
    async function createCase(specId) {
        try {
            const res = await fetch(`${base}/api/cases`, {
                method: "POST",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify(specId ? { spec_id: specId } : {}),
            });
            return await request(res);
        }
        catch {
            return { data: null, error: { status: 0, message: "Network error" } };
        }
    }
    async function deleteCase(caseId) {
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
        }
        catch {
            return { data: null, error: { status: 0, message: "Network error" } };
        }
    }
    async function getCase(caseId) {
        try {
            const res = await fetch(`${base}/api/cases/${caseId}`, { headers: authHeaders() });
            return await request(res);
        }
        catch {
            return { data: null, error: { status: 0, message: "Network error" } };
        }
    }
    async function getCaseStatus(caseId) {
        try {
            const res = await fetch(`${base}/api/cases/${caseId}/status`, { headers: authHeaders() });
            return await request(res);
        }
        catch {
            return { data: null, error: { status: 0, message: "Network error" } };
        }
    }
    /** Trigger qualification on an extracted case. Pass specId to run a specific spec. */
    async function qualifyCase(caseId, specId) {
        try {
            const url = specId
                ? `${base}/api/cases/${caseId}/qualify?spec_id=${encodeURIComponent(specId)}`
                : `${base}/api/cases/${caseId}/qualify`;
            const res = await fetch(url, { method: "POST", headers: authHeaders() });
            return await request(res);
        }
        catch {
            return { data: null, error: { status: 0, message: "Network error" } };
        }
    }
    /** Upload one or more PDFs to a case. API expects `files` (plural) field. */
    async function uploadFiles(caseId, files) {
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
            return await request(res);
        }
        catch {
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
    function streamEventsParsed(caseId, onEvent, onError) {
        const controller = new AbortController();
        const url = `${base}/api/cases/${caseId}/events/stream`;
        void consumeSseEventStream(url, authHeaders(), controller.signal, onEvent, onError);
        return { abort: () => controller.abort() };
    }
    async function getEvents(caseId, opts) {
        try {
            let url = `${base}/api/cases/${caseId}/events`;
            if (opts?.eventType) {
                url += `?event_type=${encodeURIComponent(opts.eventType)}`;
            }
            const res = await fetch(url, { headers: authHeaders() });
            return await request(res);
        }
        catch {
            return { data: null, error: { status: 0, message: "Network error" } };
        }
    }
    async function getAudit(caseId) {
        try {
            const res = await fetch(`${base}/api/cases/${caseId}/audit`, { headers: authHeaders() });
            return await request(res);
        }
        catch {
            return { data: null, error: { status: 0, message: "Network error" } };
        }
    }
    async function listDocuments(caseId) {
        try {
            const res = await fetch(`${base}/api/cases/${caseId}/documents`, { headers: authHeaders() });
            return await request(res);
        }
        catch {
            return { data: null, error: { status: 0, message: "Network error" } };
        }
    }
    async function listExtractions(caseId, opts) {
        try {
            const url = opts?.docId
                ? `${base}/api/cases/${caseId}/extractions?doc_id=${encodeURIComponent(opts.docId)}`
                : `${base}/api/cases/${caseId}/extractions`;
            const res = await fetch(url, { headers: authHeaders() });
            return await request(res);
        }
        catch {
            return { data: null, error: { status: 0, message: "Network error" } };
        }
    }
    async function getBanking(caseId) {
        try {
            const res = await fetch(`${base}/api/cases/${caseId}/banking`, { headers: authHeaders() });
            return await request(res);
        }
        catch {
            return { data: null, error: { status: 0, message: "Network error" } };
        }
    }
    async function listTransactions(caseId, docId) {
        try {
            const res = await fetch(`${base}/api/cases/${caseId}/documents/${docId}/transactions`, { headers: authHeaders() });
            return await request(res);
        }
        catch {
            return { data: null, error: { status: 0, message: "Network error" } };
        }
    }
    /** Build the page PNG URL for a (case, file, page) triple. Does NOT fetch. */
    function pagePngUrl(caseId, fileId, pageNumber) {
        return `${base}/api/cases/${caseId}/files/${fileId}/pages/${pageNumber}.png`;
    }
    /** Issue a portal token for a borrower on a case. Caller supplies identity_id. */
    async function createPortalToken(caseId, body) {
        try {
            const res = await fetch(`${base}/api/cases/${caseId}/portal-tokens`, {
                method: "POST",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify(body),
            });
            return await request(res);
        }
        catch {
            return { data: null, error: { status: 0, message: "Network error" } };
        }
    }
    /** Fetch AI-generated advice items for a scenario. */
    async function getCaseScenarioAdvice(caseId, scenarioId) {
        try {
            const res = await fetch(`${base}/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/advice`, { headers: authHeaders() });
            return await request(res);
        }
        catch {
            return { data: null, error: { status: 0, message: "Network error" } };
        }
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
        createPortalToken,
        getCaseScenarioAdvice,
    };
}
//# sourceMappingURL=operator-cases.js.map