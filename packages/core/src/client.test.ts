import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPortalClient } from "./client.js";
import { createOperatorClient } from "./operator-client.js";

const SESSION_FIXTURE = {
	session_id: "sess-1",
	entity: { identity_id: "id-1", name: "Alice", role: "borrower" },
	case_id: "case-1",
	case_state: "active",
	checklist: [],
	consent: { sms_opt_in: false, email_opt_in: false, doc_sharing: false, electronic_records: false, credit_pull: false },
	verification: { level: 0, verified: false },
	upload_config: { max_file_size_mb: 25, accepted_types: [".pdf"], endpoint: "" },
};

beforeEach(() => {
	vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("createPortalClient", () => {
	const client = createPortalClient();

	describe("fetchSession", () => {
		it("returns session on success", async () => {
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => SESSION_FIXTURE,
			} as Response);

			const result = await client.fetchSession("tok-1");
			expect(result.session).toEqual(SESSION_FIXTURE);
			expect(result.error).toBeNull();
		});

		it("returns expired error on 401", async () => {
			vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401 } as Response);
			const result = await client.fetchSession("expired");
			expect(result.error?.code).toBe("expired");
			expect(result.session).toBeNull();
		});

		it("returns server error on non-401 HTTP error", async () => {
			vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);
			const result = await client.fetchSession("tok-1");
			expect(result.error?.code).toBe("server");
			expect(result.error?.status).toBe(500);
		});

		it("returns network error on fetch throw", async () => {
			vi.mocked(fetch).mockRejectedValue(new Error("network down"));
			const result = await client.fetchSession("tok-1");
			expect(result.error?.code).toBe("network");
		});

		it("uses X-Portal-Token header, not URL query param", async () => {
			vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => SESSION_FIXTURE } as Response);
			await client.fetchSession("tok-secret");
			const [url, init] = vi.mocked(fetch).mock.calls[0];
			expect(String(url)).not.toContain("tok-secret");
			expect((init as RequestInit).headers).toMatchObject({ "X-Portal-Token": "tok-secret" });
		});
	});

	describe("submitIntents", () => {
		it("returns updated session on success", async () => {
			const updated = { ...SESSION_FIXTURE, case_state: "submitted" };
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => ({ session: updated }),
			} as Response);

			const result = await client.submitIntents("sess-1", "tok-1", [{ type: "consent", params: { consent_type: "sms_opt_in", granted: true } }]);
			expect(result.session?.case_state).toBe("submitted");
			expect(result.error).toBeNull();
		});

		it("returns server error on non-ok response", async () => {
			vi.mocked(fetch).mockResolvedValue({ ok: false, status: 409 } as Response);
			const result = await client.submitIntents("sess-1", "tok-1", []);
			expect(result.error?.code).toBe("server");
		});

		it("respects custom baseUrl", async () => {
			const customClient = createPortalClient({ baseUrl: "https://api.example.com" });
			vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ session: SESSION_FIXTURE }) } as Response);
			await customClient.submitIntents("sess-1", "tok-1", []);
			expect(vi.mocked(fetch).mock.calls[0][0]).toContain("https://api.example.com");
		});
	});
});

describe("createOperatorClient", () => {
	const client = createOperatorClient({ bearerToken: "tok" });

	describe("pagePngUrl", () => {
		it("builds a URL from case, file, and page", () => {
			expect(
				client.pagePngUrl("c-1", "f-2", 3),
			).toBe("/api/cases/c-1/files/f-2/pages/3.png");
		});

		it("respects a custom baseUrl", () => {
			const c = createOperatorClient({
				bearerToken: "tok",
				baseUrl: "https://api.example.com",
			});
			expect(c.pagePngUrl("c", "f", 1)).toBe(
				"https://api.example.com/api/cases/c/files/f/pages/1.png",
			);
		});
	});

	describe("listDocuments", () => {
		beforeEach(() => {
			vi.stubGlobal("fetch", vi.fn());
		});
		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("GETs /cases/{id}/documents with auth", async () => {
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => [{ doc_id: "d-1", file_id: "f-1", doc_type: "BankStatement" }],
			} as unknown as Response);
			const res = await client.listDocuments("case-1");
			expect(res.error).toBeNull();
			expect(res.data).toHaveLength(1);
			expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/cases/case-1/documents");
			const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>;
			expect(headers["Authorization"]).toBe("Bearer tok");
		});
	});

	describe("listExtractions", () => {
		beforeEach(() => {
			vi.stubGlobal("fetch", vi.fn());
		});
		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("appends doc_id query param when provided", async () => {
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => [],
			} as unknown as Response);
			await client.listExtractions("c", { docId: "d-42" });
			expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
				"/api/cases/c/extractions?doc_id=d-42",
			);
		});

		it("omits query param when docId is undefined", async () => {
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => [],
			} as unknown as Response);
			await client.listExtractions("c");
			expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/cases/c/extractions");
		});
	});

	describe("getBanking", () => {
		beforeEach(() => {
			vi.stubGlobal("fetch", vi.fn());
		});
		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("GETs /cases/{id}/banking", async () => {
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => ({ accounts: [], total_gross_deposits: 0, total_average_monthly: 0 }),
			} as unknown as Response);
			const res = await client.getBanking("case-1");
			expect(res.data?.accounts).toEqual([]);
			expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/cases/case-1/banking");
		});
	});
});
