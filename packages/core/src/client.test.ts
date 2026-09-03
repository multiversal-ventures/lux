import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPortalClient, VeritasClient } from "./client.js";
import { createOperatorClient } from "./operator-client.js";

// ─── VeritasClient test helpers ───────────────────────────────────────────────

function makeTestClient(): VeritasClient {
	return new VeritasClient({
		baseUrl: "",
		auth: { getToken: async () => "test-token" },
	});
}

function mockFetch(data: unknown): void {
	vi.mocked(fetch).mockResolvedValue({
		ok: true,
		headers: { get: () => "application/json" } as unknown as Headers,
		json: async () => data,
		text: async () => JSON.stringify(data),
	} as unknown as Response);
}

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

// ─── VeritasClient method tests ───────────────────────────────────────────────

describe("VeritasClient", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("getAudit", () => {
		it("calls GET /cases/:id/audit and returns array", async () => {
			const client = makeTestClient();
			mockFetch([{ spec_name: "fnma_w2", outcome: "pass" }]);
			const result = await client.getAudit("case-123");
			expect(result).toHaveLength(1);
			expect(result[0].spec_name).toBe("fnma_w2");
		});
	});

	describe("getSpecAudit", () => {
		it("calls GET /cases/:id/audit/specs/:specName and returns object", async () => {
			const client = makeTestClient();
			mockFetch({ spec_name: "fnma_w2", outcome: "pass" });
			const result = await client.getSpecAudit("case-123", "fnma_w2");
			expect(result.spec_name).toBe("fnma_w2");
		});
	});

	describe("getCaseScenarioAdvice", () => {
		it("calls GET /cases/:id/scenarios/:sid/advice", async () => {
			const client = makeTestClient();
			mockFetch({ items: [], narrative: "All good." });
			const result = await client.getCaseScenarioAdvice("case-1", "scenario-1");
			expect(result.narrative).toBe("All good.");
		});
	});

	// The POS portal wire contract. The modal tests stub `onCreate`, so these are
	// the only tests that exercise the path, the verb and the body keys the
	// server actually parses (`product_id`, `label`, `active`).
	describe("POS portals", () => {
		const PORTAL_FIXTURE = {
			pos_portal_id: "pp-1",
			product_id: "dscr",
			slug: "abc123def456",
			label: "DSCR — my website",
			url: "https://apply.example.com/apply/abc123def456",
			active: true,
			expires_at: null,
			created_at: "2026-08-25T00:00:00Z",
		};

		it("createPosPortal POSTs the product and label to /api/pos-portals", async () => {
			const client = makeTestClient();
			mockFetch(PORTAL_FIXTURE);
			const created = await client.createPosPortal({
				product_id: "dscr",
				label: "DSCR — my website",
			});
			expect(created.slug).toBe("abc123def456");
			const [url, init] = vi.mocked(fetch).mock.calls[0];
			expect(url).toBe("/api/pos-portals");
			expect(init?.method).toBe("POST");
			expect(JSON.parse(String(init?.body))).toEqual({
				product_id: "dscr",
				label: "DSCR — my website",
			});
		});

		it("listPosPortals GETs /api/pos-portals", async () => {
			const client = makeTestClient();
			mockFetch([PORTAL_FIXTURE]);
			const portals = await client.listPosPortals();
			expect(portals).toHaveLength(1);
			expect(portals[0].pos_portal_id).toBe("pp-1");
			const [url, init] = vi.mocked(fetch).mock.calls[0];
			expect(url).toBe("/api/pos-portals");
			expect(init?.method ?? "GET").toBe("GET");
		});

		it("deactivatePosPortal PATCHes {active:false} to the portal's own path", async () => {
			const client = makeTestClient();
			mockFetch({ ...PORTAL_FIXTURE, active: false });
			const updated = await client.deactivatePosPortal("pp-1");
			expect(updated.active).toBe(false);
			const [url, init] = vi.mocked(fetch).mock.calls[0];
			expect(url).toBe("/api/pos-portals/pp-1");
			expect(init?.method).toBe("PATCH");
			expect(JSON.parse(String(init?.body))).toEqual({ active: false });
		});

		it("deactivatePosPortal escapes the id into the path", async () => {
			const client = makeTestClient();
			mockFetch({ ...PORTAL_FIXTURE, active: false });
			// Server-minted UUIDs never need this, so it is a consistency guard
			// with the sibling client (`operator-cases.ts` encodes every segment)
			// rather than a live exposure — an id is never allowed to add a path.
			await client.deactivatePosPortal("pp/../me");
			expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/pos-portals/pp%2F..%2Fme");
		});

		it("listPosPortalCases GETs the link's own /cases sub-resource", async () => {
			const client = makeTestClient();
			mockFetch([
				{
					case_id: "case-1",
					name: null,
					state: "awaiting_verification",
					created_at: "2026-08-26T00:00:00Z",
					parties: [
						{
							party_id: "party-1",
							email: "maria@example.com",
							display_name: null,
							role: "borrower",
						},
					],
				},
			]);
			const cases = await client.listPosPortalCases("pp-1");
			// The unverified shape the operator surface renders: an email and
			// nothing else. If this ever comes back named, Task 5 changed it.
			expect(cases[0].name).toBeNull();
			expect(cases[0].parties?.[0].party_id).toBe("party-1");
			const [url, init] = vi.mocked(fetch).mock.calls[0];
			expect(url).toBe("/api/pos-portals/pp-1/cases");
			expect(init?.method ?? "GET").toBe("GET");
		});

		it("resendAccessCode POSTs to the case+party path with NO body", async () => {
			const client = makeTestClient();
			mockFetch({ ok: true, detail: "Access code re-sent to the address on file." });
			const res = await client.resendAccessCode("case-1", "party-1");
			expect(res.ok).toBe(true);
			const [url, init] = vi.mocked(fetch).mock.calls[0];
			expect(url).toBe("/api/cases/case-1/portal/parties/party-1/resend-code");
			expect(init?.method).toBe("POST");
			// Load-bearing, not incidental: a body would let a caller name the
			// recipient, which is the impersonation path the server's
			// substitution rule exists to close. The server accepts none.
			expect(init?.body).toBeUndefined();
			// And the response carries neither the code nor the address.
			expect(JSON.stringify(res)).not.toMatch(/\b\d{5}\b/);
		});

		it("resendAccessCode surfaces the refusal status, not just a message", async () => {
			const client = makeTestClient();
			vi.mocked(fetch).mockResolvedValue({
				ok: false,
				status: 409,
				headers: { get: () => "application/json" } as unknown as Headers,
				text: async () =>
					JSON.stringify({ detail: "This link has expired. Send them a new link." }),
			} as unknown as Response);
			// Both halves matter: the caller branches on `status` and renders
			// `message`, so losing either collapses four remedies into one.
			await expect(client.resendAccessCode("case-1", "party-1")).rejects.toMatchObject({
				status: 409,
				message: "This link has expired. Send them a new link.",
			});
		});

		it("raises the server's `detail` string as the error message", async () => {
			const client = makeTestClient();
			vi.mocked(fetch).mockResolvedValue({
				ok: false,
				status: 400,
				headers: { get: () => "application/json" } as unknown as Headers,
				text: async () => JSON.stringify({ detail: "Unknown or disabled product: x" }),
			} as unknown as Response);
			await expect(
				client.createPosPortal({ product_id: "x", label: "y" }),
			).rejects.toThrow("Unknown or disabled product: x");
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

	describe("getBankingTransactions", () => {
		beforeEach(() => {
			vi.stubGlobal("fetch", vi.fn());
		});
		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("GETs /cases/{id}/banking/transactions with auth", async () => {
			vi.mocked(fetch).mockResolvedValue({
				ok: true,
				json: async () => ({ case_id: "case-1", transactions: [], total_count: 0 }),
			} as unknown as Response);
			const res = await client.getBankingTransactions("case-1");
			expect(res.error).toBeNull();
			expect(res.data?.total_count).toBe(0);
			expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
				"/api/cases/case-1/banking/transactions",
			);
			const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>;
			expect(headers["Authorization"]).toBe("Bearer tok");
		});
	});
});
