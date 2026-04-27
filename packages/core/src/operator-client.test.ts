import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createOperatorClient } from "./operator-client.js";

const CASE_FIXTURE = {
	case_id: "c-1",
	spec_id: "s-1",
	state: "active",
	created_at: "2024-01-01T00:00:00Z",
};

const SPEC_FIXTURE = {
	spec_id: "s-1",
	name: "W2",
	domain: "income",
	version: "1",
	status: "approved",
};

function makeClient() {
	return createOperatorClient({ bearerToken: "tok-abc", baseUrl: "" });
}

function ok(body: unknown): Response {
	return { ok: true, status: 200, json: async () => body, text: async () => "" } as unknown as Response;
}

function fail(status = 400, text = "Bad request"): Response {
	return { ok: false, status, text: async () => text } as unknown as Response;
}

beforeEach(() => {
	vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Case lifecycle
// ---------------------------------------------------------------------------

describe("createOperatorClient — case methods", () => {
	const client = makeClient();

	it("listCases: GETs /cases with Bearer auth", async () => {
		vi.mocked(fetch).mockResolvedValue(ok([CASE_FIXTURE]));
		const res = await client.listCases();
		expect(res.error).toBeNull();
		expect(res.data).toHaveLength(1);
		expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/cases");
		expect((vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok-abc");
	});

	it("listCases: appends spec_id when provided", async () => {
		vi.mocked(fetch).mockResolvedValue(ok([]));
		await client.listCases("s-1");
		expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/cases?spec_id=s-1");
	});

	it("createCase: POSTs to /cases", async () => {
		vi.mocked(fetch).mockResolvedValue(ok(CASE_FIXTURE));
		const res = await client.createCase("s-1");
		expect(res.error).toBeNull();
		expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe("POST");
	});

	it("deleteCase: DELETEs /cases/{id}", async () => {
		vi.mocked(fetch).mockResolvedValue({ ok: true, status: 204, text: async () => "" } as unknown as Response);
		const res = await client.deleteCase("c-1");
		expect(res.error).toBeNull();
		expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe("DELETE");
	});

	it("deleteCase: returns error on non-ok response", async () => {
		vi.mocked(fetch).mockResolvedValue(fail(404, "Not found"));
		const res = await client.deleteCase("c-missing");
		expect(res.error?.status).toBe(404);
		expect(res.error?.message).toBe("Not found");
	});

	it("getCase: GETs /cases/{id}", async () => {
		vi.mocked(fetch).mockResolvedValue(ok(CASE_FIXTURE));
		const res = await client.getCase("c-1");
		expect(res.data).toEqual(CASE_FIXTURE);
		expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/cases/c-1");
	});

	it("getCaseStatus: GETs /cases/{id}/status", async () => {
		vi.mocked(fetch).mockResolvedValue(ok({ state: "active" }));
		const res = await client.getCaseStatus("c-1");
		expect(res.data?.state).toBe("active");
	});

	it("qualifyCase: POSTs /cases/{id}/qualify", async () => {
		vi.mocked(fetch).mockResolvedValue(ok({ workflow_id: "wf-1" }));
		const res = await client.qualifyCase("c-1");
		expect(res.data?.workflow_id).toBe("wf-1");
		expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe("POST");
	});

	it("qualifyCase: appends spec_id when provided", async () => {
		vi.mocked(fetch).mockResolvedValue(ok({ workflow_id: "wf-1" }));
		await client.qualifyCase("c-1", "s-1");
		expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/cases/c-1/qualify?spec_id=s-1");
	});

	it("returns network error on fetch throw", async () => {
		vi.mocked(fetch).mockRejectedValue(new Error("offline"));
		const res = await client.getCase("c-1");
		expect(res.error?.status).toBe(0);
		expect(res.error?.message).toBe("Network error");
	});

	it("getAudit: GETs /cases/{id}/audit", async () => {
		vi.mocked(fetch).mockResolvedValue(ok([]));
		const res = await client.getAudit("c-1");
		expect(res.error).toBeNull();
		expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/cases/c-1/audit");
	});

	it("uploadFiles: POSTs FormData to /cases/{id}/files", async () => {
		vi.mocked(fetch).mockResolvedValue(ok({}));
		const file = new File(["content"], "doc.pdf", { type: "application/pdf" });
		const res = await client.uploadFiles("c-1", [file]);
		expect(res.error).toBeNull();
		const [url, init] = vi.mocked(fetch).mock.calls[0];
		expect(url).toBe("/api/cases/c-1/files");
		expect(init?.method).toBe("POST");
		expect(init?.body).toBeInstanceOf(FormData);
	});

	it("listTransactions: GETs /cases/{id}/documents/{docId}/transactions", async () => {
		vi.mocked(fetch).mockResolvedValue(ok({ doc_id: "d-1", source_filename: "stmt.pdf", regions: [], total_rows: 0 }));
		const res = await client.listTransactions("c-1", "d-1");
		expect(res.error).toBeNull();
		expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/cases/c-1/documents/d-1/transactions");
	});
});

// ---------------------------------------------------------------------------
// Spec management
// ---------------------------------------------------------------------------

describe("createOperatorClient — spec methods", () => {
	const client = makeClient();

	it("generateSpec: POSTs to /api/ai/specs/generate", async () => {
		vi.mocked(fetch).mockResolvedValue(ok({ yaml: "---", name: "W2", domain: "income", version: "1" }));
		const res = await client.generateSpec("W2 income spec");
		expect(res.error).toBeNull();
		expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/ai/specs/generate");
		expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe("POST");
	});

	it("listSpecs: GETs /api/specs", async () => {
		vi.mocked(fetch).mockResolvedValue(ok([SPEC_FIXTURE]));
		const res = await client.listSpecs();
		expect(res.data).toHaveLength(1);
		expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/specs");
	});

	it("listSpecs: filters by domain", async () => {
		vi.mocked(fetch).mockResolvedValue(ok([]));
		await client.listSpecs("income");
		expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/specs?domain=income");
	});

	it("createSpec: POSTs spec payload", async () => {
		vi.mocked(fetch).mockResolvedValue(ok({ spec_id: "s-new" }));
		const res = await client.createSpec({ name: "W2", domain: "income", version: "1", yaml_content: "---" });
		expect(res.data?.spec_id).toBe("s-new");
	});

	it("submitSpec: PUTs /api/specs/{id}/submit", async () => {
		vi.mocked(fetch).mockResolvedValue(ok({}));
		await client.submitSpec("s-1");
		expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/specs/s-1/submit");
		expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe("PUT");
	});

	it("approveSpec: PUTs /api/specs/{id}/approve with approved_by", async () => {
		vi.mocked(fetch).mockResolvedValue(ok({}));
		await client.approveSpec("s-1");
		const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
		expect(body.approved_by).toBe("operator");
	});

	it("getSpecDetail: GETs /api/specs/{id}", async () => {
		vi.mocked(fetch).mockResolvedValue(ok(SPEC_FIXTURE));
		const res = await client.getSpecDetail("s-1");
		expect(res.data).toEqual(SPEC_FIXTURE);
	});
});

// ---------------------------------------------------------------------------
// SSE event streaming
// ---------------------------------------------------------------------------

describe("createOperatorClient — event streaming", () => {
	const client = makeClient();

	it("getEvents: GETs /cases/{id}/events", async () => {
		vi.mocked(fetch).mockResolvedValue(ok([{ event_id: 1, event_type: "intake.file.processed", event_data: null, created_at: null }]));
		const res = await client.getEvents("c-1");
		expect(res.error).toBeNull();
		expect(res.data).toHaveLength(1);
		expect(res.data?.[0].event_type).toBe("intake.file.processed");
	});

	it("streamEventsParsed: calls onEvent for each SSE data line", async () => {
		const ssePayload = `data: ${JSON.stringify({ event_id: 1, event_type: "qualify.completed", event_data: {}, created_at: null })}\n\ndata: ${JSON.stringify({ event_id: 2, event_type: "case.system.completed", event_data: null, created_at: null })}\n\n`;
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(ctrl) {
				ctrl.enqueue(encoder.encode(ssePayload));
				ctrl.close();
			},
		});
		vi.mocked(fetch).mockResolvedValue({ ok: true, body: stream } as unknown as Response);

		const events: string[] = [];
		const { abort } = client.streamEventsParsed("c-1", (ev) => {
			events.push(ev.event_type);
		});

		// Drain: one macrotask after all microtasks is sufficient for in-memory streams.
		await new Promise((r) => setTimeout(r, 0));
		abort();
		expect(events).toContain("qualify.completed");
		expect(events).toContain("case.system.completed");
	});

	it("streamEventsParsed: calls onError on fetch failure", async () => {
		vi.mocked(fetch).mockRejectedValue(new Error("network failure"));
		const errors: string[] = [];
		const { abort } = client.streamEventsParsed("c-1", () => {}, (err) => {
			errors.push(err.message);
		});
		await new Promise((r) => setTimeout(r, 0));
		abort();
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("connect");
	});

	it("streamEventsParsed: calls onError when body is null", async () => {
		vi.mocked(fetch).mockResolvedValue({ ok: true, body: null } as unknown as Response);
		const errors: string[] = [];
		client.streamEventsParsed("c-1", () => {}, (err) => errors.push(err.message));
		await new Promise((r) => setTimeout(r, 0));
		expect(errors[0]).toContain("No response body");
	});

	it("streamEventsParsed: skips malformed SSE lines", async () => {
		const ssePayload = `data: not-json\ndata: ${JSON.stringify({ event_id: 3, event_type: "qualify.completed", event_data: {}, created_at: null })}\n\n`;
		const stream = new ReadableStream({
			start(ctrl) {
				ctrl.enqueue(new TextEncoder().encode(ssePayload));
				ctrl.close();
			},
		});
		vi.mocked(fetch).mockResolvedValue({ ok: true, body: stream } as unknown as Response);
		const events: number[] = [];
		client.streamEventsParsed("c-1", (ev) => events.push(ev.event_id));
		await new Promise((r) => setTimeout(r, 0));
		expect(events).toEqual([3]);
	});
});

// ---------------------------------------------------------------------------
// generateSpecStream
// ---------------------------------------------------------------------------

describe("createOperatorClient — generateSpecStream", () => {
	const client = makeClient();

	it("streams chunks and resolves with meta", async () => {
		const metaBlock = { name: "W2", domain: "income", version: "1" };
		const chunk1 = `data: ${JSON.stringify("spec content\n")}\n\n`;
		const chunk2 = `data: ${JSON.stringify(`\nMETA:${JSON.stringify(metaBlock)}`)}\n\n`;
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(ctrl) {
				ctrl.enqueue(encoder.encode(chunk1 + chunk2));
				ctrl.close();
			},
		});
		vi.mocked(fetch).mockResolvedValue({ ok: true, body: stream } as unknown as Response);

		const chunks: string[] = [];
		const res = await client.generateSpecStream("W2 spec", (c) => chunks.push(c));
		expect(res.error).toBeNull();
		expect(res.data?.name).toBe("W2");
		expect(res.data?.yaml).toContain("spec content");
		expect(chunks.length).toBeGreaterThan(0);
	});

	it("returns error when stream has no META", async () => {
		const stream = new ReadableStream({
			start(ctrl) {
				ctrl.enqueue(new TextEncoder().encode(`data: ${JSON.stringify("partial\n")}\n\n`));
				ctrl.close();
			},
		});
		vi.mocked(fetch).mockResolvedValue({ ok: true, body: stream } as unknown as Response);
		const res = await client.generateSpecStream("desc", () => {});
		expect(res.error?.status).toBe(500);
		expect(res.error?.message).toContain("metadata");
	});

	it("returns error on server-side error chunk", async () => {
		const errorChunk = `data: ${JSON.stringify('{"error":"Internal failure"}')}\n\n`;
		const stream = new ReadableStream({
			start(ctrl) {
				ctrl.enqueue(new TextEncoder().encode(errorChunk));
				ctrl.close();
			},
		});
		vi.mocked(fetch).mockResolvedValue({ ok: true, body: stream } as unknown as Response);
		const res = await client.generateSpecStream("desc", () => {});
		expect(res.error?.status).toBe(502);
		expect(res.error?.message).toContain("Internal failure");
	});

	it("returns network error on fetch throw", async () => {
		vi.mocked(fetch).mockRejectedValue(new Error("offline"));
		const res = await client.generateSpecStream("desc", () => {});
		expect(res.error?.status).toBe(0);
	});
});
