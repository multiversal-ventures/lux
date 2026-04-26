import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";
import type { OperatorClient } from "@fenero/lux-core";
import { OperatorProvider } from "../providers/OperatorProvider.js";
import {
	useCase,
	useCases,
	useSpecs,
	useSpecDetail,
	useDocuments,
	useExtractions,
	useBanking,
	useAudit,
} from "./index.js";
import { useOperatorQuery } from "./_useOperatorQuery.js";

const FakeClientContext = createContext<OperatorClient | null>(null);
vi.mock("../providers/OperatorProvider", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../providers/OperatorProvider")>();
	return {
		...actual,
		useOperatorClient: () => {
			const fake = useContext(FakeClientContext);
			if (!fake) throw new Error("test: fake client missing");
			return fake;
		},
	};
});

function makeClient(partial: Partial<OperatorClient>): OperatorClient {
	return partial as unknown as OperatorClient;
}

function makeWrapper(client: OperatorClient, qc?: QueryClient) {
	const qcInstance = qc ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={qcInstance}>
			<OperatorProvider bearerToken="t" queryClient={qcInstance}>
				<FakeClientContext.Provider value={client}>{children}</FakeClientContext.Provider>
			</OperatorProvider>
		</QueryClientProvider>
	);
}

describe("query hooks", () => {
	it("useCase calls getCase with the caseId", async () => {
		const client = makeClient({
			getCase: vi.fn().mockResolvedValue({
				data: { case_id: "c-1", tenant_id: "t", state: "completed", pool_version: 0 },
				error: null,
			}),
		});
		const { result } = renderHook(() => useCase("c-1"), {
			wrapper: makeWrapper(client),
		});
		await waitFor(() => expect(result.current.data?.case_id).toBe("c-1"));
		expect(client.getCase).toHaveBeenCalledWith("c-1");
	});

	it("useCases accepts optional specId", async () => {
		const client = makeClient({
			listCases: vi.fn().mockResolvedValue({ data: [], error: null }),
		});
		const { result } = renderHook(() => useCases({ specId: "s-9" }), {
			wrapper: makeWrapper(client),
		});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(client.listCases).toHaveBeenCalledWith("s-9");
	});

	it("useSpecs passes domain", async () => {
		const client = makeClient({
			listSpecs: vi.fn().mockResolvedValue({ data: [], error: null }),
		});
		renderHook(() => useSpecs({ domain: "income" }), { wrapper: makeWrapper(client) });
		await waitFor(() => expect(client.listSpecs).toHaveBeenCalledWith("income"));
	});

	it("useSpecDetail calls getSpecDetail", async () => {
		const client = makeClient({
			getSpecDetail: vi.fn().mockResolvedValue({
				data: { spec_id: "s-1", name: "x" },
				error: null,
			}),
		});
		renderHook(() => useSpecDetail("s-1"), { wrapper: makeWrapper(client) });
		await waitFor(() => expect(client.getSpecDetail).toHaveBeenCalledWith("s-1"));
	});

	it("useDocuments calls listDocuments", async () => {
		const client = makeClient({
			listDocuments: vi.fn().mockResolvedValue({ data: [], error: null }),
		});
		renderHook(() => useDocuments("c"), { wrapper: makeWrapper(client) });
		await waitFor(() => expect(client.listDocuments).toHaveBeenCalledWith("c"));
	});

	it("useExtractions passes docId", async () => {
		const client = makeClient({
			listExtractions: vi.fn().mockResolvedValue({ data: [], error: null }),
		});
		renderHook(() => useExtractions("c", { docId: "d-1" }), {
			wrapper: makeWrapper(client),
		});
		await waitFor(() =>
			expect(client.listExtractions).toHaveBeenCalledWith("c", { docId: "d-1" }),
		);
	});

	it("useBanking calls getBanking", async () => {
		const client = makeClient({
			getBanking: vi.fn().mockResolvedValue({
				data: { accounts: [], total_gross_deposits: 0, total_average_monthly: 0 },
				error: null,
			}),
		});
		renderHook(() => useBanking("c"), { wrapper: makeWrapper(client) });
		await waitFor(() => expect(client.getBanking).toHaveBeenCalledWith("c"));
	});

	it("useAudit calls getAudit", async () => {
		const client = makeClient({
			getAudit: vi.fn().mockResolvedValue({ data: [], error: null }),
		});
		renderHook(() => useAudit("c"), { wrapper: makeWrapper(client) });
		await waitFor(() => expect(client.getAudit).toHaveBeenCalledWith("c"));
	});

	it("converts client errors into React Query errors", async () => {
		const client = makeClient({
			getCase: vi.fn().mockResolvedValue({
				data: null,
				error: { status: 500, message: "boom" },
			}),
		});
		const { result } = renderHook(() => useCase("c"), {
			wrapper: makeWrapper(client),
		});
		await waitFor(() => expect(result.current.isError).toBe(true));
		const err = result.current.error as { status: number; message: string };
		expect(err.status).toBe(500);
	});
});

// ---------------------------------------------------------------------------
// _useOperatorQuery
// ---------------------------------------------------------------------------

describe("useOperatorQuery", () => {
	type FakeResult = import("@fenero/lux-core").Result<unknown[]>;

	it("returns data when Result.data is set", async () => {
		const fetcher = vi.fn().mockResolvedValue({ data: ["item-1"], error: null } as FakeResult);
		const mockClient = makeClient({});
		const { result } = renderHook(
			() => useOperatorQuery(["q-ok"], (_c) => fetcher(_c) as Promise<FakeResult>),
			{ wrapper: makeWrapper(mockClient) },
		);
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual(["item-1"]);
	});

	it("throws the OperatorClientError when Result.error is set", async () => {
		const fetcher = vi.fn().mockResolvedValue({ data: null, error: { status: 503, message: "Service unavailable" } } as FakeResult);
		const mockClient = makeClient({});
		const { result } = renderHook(
			() => useOperatorQuery(["q-err"], (_c) => fetcher(_c) as Promise<FakeResult>),
			{ wrapper: makeWrapper(mockClient) },
		);
		await waitFor(() => expect(result.current.isError).toBe(true));
		const err = result.current.error as { status: number; message: string };
		expect(err.status).toBe(503);
		expect(err.message).toBe("Service unavailable");
	});
});
