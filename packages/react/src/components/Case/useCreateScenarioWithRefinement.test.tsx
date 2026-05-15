import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { useCreateScenarioWithRefinement } from "./useCreateScenarioWithRefinement.js";

vi.mock("@fenero-ai/lux-core", async () => {
  const actual = await vi.importActual<typeof import("@fenero-ai/lux-core")>("@fenero-ai/lux-core");
  return {
    ...actual,
    getDefaultClient: () => mockClient,
  };
});

interface MockClient {
  createCaseScenario: ReturnType<typeof vi.fn>;
  createCaseScenarioRefinement: ReturnType<typeof vi.fn>;
  startCaseScenarioRefinement: ReturnType<typeof vi.fn>;
}

const mockClient: MockClient = {
  createCaseScenario: vi.fn(),
  createCaseScenarioRefinement: vi.fn(),
  startCaseScenarioRefinement: vi.fn(),
};

beforeEach(() => {
  mockClient.createCaseScenario.mockReset();
  mockClient.createCaseScenarioRefinement.mockReset();
  mockClient.startCaseScenarioRefinement.mockReset();
});

function wrap(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("useCreateScenarioWithRefinement", () => {
  it("chains create → refine → start and returns combined ids", async () => {
    mockClient.createCaseScenario.mockResolvedValue({ scenario_id: "s1" });
    mockClient.createCaseScenarioRefinement.mockResolvedValue({
      refinement_id: "r1",
      refinement_num: 0,
      status: "created",
    });
    mockClient.startCaseScenarioRefinement.mockResolvedValue({
      status: "started",
      workflow_id: "wf-1",
      message: "ok",
    });

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useCreateScenarioWithRefinement("c1"), {
      wrapper: wrap(qc),
    });

    let returned: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        approach: "qualified_mortgage",
        productIds: ["fannie_mae"],
        borrowerIds: ["b1"],
        documentIds: ["d1"],
        note: "first run",
      });
    });

    expect(mockClient.createCaseScenario).toHaveBeenCalledWith("c1", {
      approach: "qualified_mortgage",
      pool_version: 0,
    });
    expect(mockClient.createCaseScenarioRefinement).toHaveBeenCalledWith("c1", "s1", {
      borrower_ids: ["b1"],
      document_ids: ["d1"],
      product_ids: ["fannie_mae"],
      spec_ids: null,
      note: "first run",
    });
    expect(mockClient.startCaseScenarioRefinement).toHaveBeenCalledWith("c1", "s1", "r1");
    expect(returned).toMatchObject({
      scenarioId: "s1",
      refinementId: "r1",
      refinementNum: 0,
      workflowId: "wf-1",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("skips the start call when start=false", async () => {
    mockClient.createCaseScenario.mockResolvedValue({ scenario_id: "s2" });
    mockClient.createCaseScenarioRefinement.mockResolvedValue({
      refinement_id: "r2",
      refinement_num: 1,
      status: "created",
    });

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useCreateScenarioWithRefinement("c1"), {
      wrapper: wrap(qc),
    });

    let returned: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        approach: "non_qualified_mortgage",
        productIds: ["non_qm_bank_statement"],
        start: false,
      });
    });

    expect(mockClient.startCaseScenarioRefinement).not.toHaveBeenCalled();
    expect(returned?.workflowId).toBeNull();
  });
});
