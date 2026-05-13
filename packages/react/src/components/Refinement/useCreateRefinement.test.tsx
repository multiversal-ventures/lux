import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { useCreateRefinement } from "./useCreateRefinement.js";

vi.mock("@fenero/lux-core", async () => {
  const actual = await vi.importActual<typeof import("@fenero/lux-core")>("@fenero/lux-core");
  return {
    ...actual,
    getDefaultClient: () => mockClient,
  };
});

const mockClient = {
  createCaseScenarioRefinement: vi.fn(),
  startCaseScenarioRefinement: vi.fn(),
};

beforeEach(() => {
  mockClient.createCaseScenarioRefinement.mockReset();
  mockClient.startCaseScenarioRefinement.mockReset();
});

function wrap(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("useCreateRefinement", () => {
  it("creates + starts a refinement, passing user_inputs through", async () => {
    mockClient.createCaseScenarioRefinement.mockResolvedValue({
      refinement_id: "r1",
      refinement_num: 1,
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
    const { result } = renderHook(() => useCreateRefinement("c1"), { wrapper: wrap(qc) });

    let returned: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        scenarioId: "s1",
        productIds: ["fannie_mae"],
        context: { fannie_mae: { inputs: { y1_override: "2024", y2_override: "2023" } } },
      });
    });

    expect(mockClient.createCaseScenarioRefinement).toHaveBeenCalledWith("c1", "s1", {
      borrower_ids: null,
      document_ids: null,
      product_ids: ["fannie_mae"],
      spec_ids: null,
      note: null,
      context: { fannie_mae: { inputs: { y1_override: "2024", y2_override: "2023" } } },
    });
    expect(mockClient.startCaseScenarioRefinement).toHaveBeenCalledWith("c1", "s1", "r1");
    expect(returned).toMatchObject({
      refinementId: "r1",
      refinementNum: 1,
      workflowId: "wf-1",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("skips start when start=false", async () => {
    mockClient.createCaseScenarioRefinement.mockResolvedValue({
      refinement_id: "r2",
      refinement_num: 2,
      status: "created",
    });

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useCreateRefinement("c1"), { wrapper: wrap(qc) });

    let returned: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({
        scenarioId: "s1",
        start: false,
      });
    });

    expect(mockClient.startCaseScenarioRefinement).not.toHaveBeenCalled();
    expect(returned?.workflowId).toBeNull();
  });
});
