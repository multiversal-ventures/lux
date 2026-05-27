import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import type { CaseResponse } from "@multiversal-ventures/lux-core";
import { useCasesList, useDeleteCase, casesListQueryKey } from "./useCasesList.js";

vi.mock("@multiversal-ventures/lux-core", async () => {
  const actual = await vi.importActual<typeof import("@multiversal-ventures/lux-core")>(
    "@multiversal-ventures/lux-core",
  );
  return {
    ...actual,
    getDefaultClient: () => mockClient,
  };
});

const mockClient = {
  listTenantCases: vi.fn(),
  deleteCase: vi.fn(),
};

function makeCase(id: string): CaseResponse {
  return {
    case_id: id,
    tenant_id: "t",
    name: id,
    pool_version: 0,
    state: "completed",
    created_at: "2026-01-01T00:00:00Z",
    file_count: 1,
  };
}

beforeEach(() => {
  mockClient.listTenantCases.mockReset();
  mockClient.deleteCase.mockReset();
});

function wrap(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function makeQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe("useCasesList", () => {
  it("fetches with the given limit", async () => {
    mockClient.listTenantCases.mockResolvedValue([makeCase("c-1")]);
    const { result } = renderHook(() => useCasesList({ limit: 50 }), { wrapper: wrap(makeQc()) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockClient.listTenantCases).toHaveBeenCalledWith(50);
    expect(result.current.data?.[0].case_id).toBe("c-1");
  });

  it("defaults limit to 20", async () => {
    mockClient.listTenantCases.mockResolvedValue([]);
    renderHook(() => useCasesList(), { wrapper: wrap(makeQc()) });
    await waitFor(() => expect(mockClient.listTenantCases).toHaveBeenCalledWith(20));
  });
});

describe("useDeleteCase", () => {
  it("optimistically removes the case from the list cache before the request resolves", async () => {
    const qc = makeQc();
    qc.setQueryData(casesListQueryKey(50), [makeCase("c-1"), makeCase("c-2")]);

    let resolveDelete: () => void = () => {};
    mockClient.deleteCase.mockReturnValue(new Promise<void>((res) => { resolveDelete = res; }));

    const { result } = renderHook(() => useDeleteCase(), { wrapper: wrap(qc) });

    act(() => {
      result.current.mutate("c-1");
    });

    // Row gone immediately, before backend confirms (eventual-consistency fix).
    await waitFor(() => {
      const cached = qc.getQueryData<CaseResponse[]>(casesListQueryKey(50));
      expect(cached?.map((c) => c.case_id)).toEqual(["c-2"]);
    });

    await act(async () => {
      resolveDelete();
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
    expect(mockClient.deleteCase).toHaveBeenCalledWith("c-1");
  });

  it("rolls back the cache when the delete fails", async () => {
    const qc = makeQc();
    qc.setQueryData(casesListQueryKey(50), [makeCase("c-1"), makeCase("c-2")]);
    mockClient.deleteCase.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useDeleteCase(), { wrapper: wrap(qc) });

    await act(async () => {
      await result.current.mutateAsync("c-1").catch(() => {});
    });

    await waitFor(() => {
      const cached = qc.getQueryData<CaseResponse[]>(casesListQueryKey(50));
      expect(cached?.map((c) => c.case_id)).toEqual(["c-1", "c-2"]);
    });
  });
});
