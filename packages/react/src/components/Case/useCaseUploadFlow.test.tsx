import { act, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { StrictMode, type ReactNode } from "react";
import { CaseWorkflowProvider } from "./CaseWorkflowProvider.js";
import { useCaseUploadFlow } from "./useCaseUploadFlow.js";
import type { UseCaseUploadFlowResult } from "./useCaseUploadFlow.js";

vi.mock("@multiversal-ventures/lux-core", async () => {
  const actual = await vi.importActual<typeof import("@multiversal-ventures/lux-core")>("@multiversal-ventures/lux-core");
  return {
    ...actual,
    getDefaultClient: () => mockClient,
  };
});

const mockClient = {
  getCaseDocuments: vi.fn(),
  getCaseFiles: vi.fn(),
};

const qc = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function Wrapper({ caseId, children }: { caseId: string; children: ReactNode }) {
  return (
    <QueryClientProvider client={qc}>
      <CaseWorkflowProvider caseId={caseId}>{children}</CaseWorkflowProvider>
    </QueryClientProvider>
  );
}

function Probe({
  captured,
}: {
  captured: { value?: UseCaseUploadFlowResult };
}) {
  captured.value = useCaseUploadFlow();
  return null;
}

beforeEach(() => {
  qc.clear();
  mockClient.getCaseDocuments.mockReset();
  mockClient.getCaseFiles.mockReset();
});

describe("useCaseUploadFlow", () => {
  it("derives newDocuments by diffing against previousDocIds", async () => {
    // Initial state has one document — captured as the baseline.
    mockClient.getCaseDocuments.mockResolvedValueOnce([
      {
        doc_id: "d1",
        doc_type: "w2",
        original_filename: "old.pdf",
        file_id: "f1",
        page_numbers: [1],
        effective_period_start: null,
        effective_period_end: null,
        tax_year: 2022,
      },
    ]);
    mockClient.getCaseFiles.mockResolvedValue([]);

    const captured: { value?: UseCaseUploadFlowResult } = {};
    render(
      <Wrapper caseId="c-new-docs">
        <Probe captured={captured} />
      </Wrapper>,
    );

    // Wait one microtask + a synchronous read so React Query resolves.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(captured.value?.phase).toBe("idle");

    // User starts an upload — capture baseline.
    await act(async () => {
      captured.value!.beginUpload({
        fileNames: ["new.pdf"],
        currentDocIds: ["d1"],
      });
    });
    expect(captured.value?.phase).toBe("uploading");
    expect(captured.value?.newDocuments.length).toBe(0);

    // Extraction completes; a new doc arrives in the cache.
    mockClient.getCaseDocuments.mockResolvedValueOnce([
      {
        doc_id: "d1",
        doc_type: "w2",
        original_filename: "old.pdf",
        file_id: "f1",
        page_numbers: [1],
        effective_period_start: null,
        effective_period_end: null,
        tax_year: 2022,
      },
      {
        doc_id: "d2",
        doc_type: "form_1040",
        original_filename: "new.pdf",
        file_id: "f2",
        page_numbers: [1, 2],
        effective_period_start: null,
        effective_period_end: null,
        tax_year: 2023,
      },
    ]);
    await act(async () => {
      await qc.refetchQueries({ queryKey: ["lux", "case", "c-new-docs", "documents"] });
    });

    // The docs-delta bridge should auto-transition to "reviewing"
    // and `newDocuments` should contain only the new id. The transition
    // happens inside a `useEffect` so wait for the next paint.
    await waitFor(() => {
      expect(captured.value?.phase).toBe("reviewing");
    });
    expect(captured.value?.newDocuments.map((d) => d.id)).toEqual(["d2"]);
  });

  it("does not infinite-loop under React 19 StrictMode (snapshot stability)", async () => {
    // React 19's `useSyncExternalStore` asserts that `getSnapshot` returns
    // a cached value when state hasn't changed. A composite-object zustand
    // selector without `useShallow` would synthesize a new object every
    // call and trigger an "infinite loop" warning. Subscribing per
    // primitive (as we do) keeps every snapshot a primitive/stable ref.
    mockClient.getCaseDocuments.mockResolvedValue([]);
    mockClient.getCaseFiles.mockResolvedValue([]);

    const captured: { value?: UseCaseUploadFlowResult } = {};
    render(
      <StrictMode>
        <Wrapper caseId="c-strict">
          <Probe captured={captured} />
        </Wrapper>
      </StrictMode>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(captured.value?.phase).toBe("idle");

    await act(async () => {
      captured.value!.beginUpload({ fileNames: ["s.pdf"], currentDocIds: [] });
    });
    // If snapshot stability were broken, this assertion (or the prior act)
    // would explode with React's "Maximum update depth exceeded".
    expect(captured.value?.phase).toBe("uploading");
  });

  it("confirmReview collapses back to idle", async () => {
    mockClient.getCaseDocuments.mockResolvedValue([]);
    mockClient.getCaseFiles.mockResolvedValue([]);

    const captured: { value?: UseCaseUploadFlowResult } = {};
    render(
      <Wrapper caseId="c-collapse">
        <Probe captured={captured} />
      </Wrapper>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      captured.value!.beginUpload({ fileNames: ["x.pdf"], currentDocIds: [] });
      captured.value!.markReviewing();
    });
    expect(captured.value?.phase).toBe("reviewing");

    await act(async () => {
      captured.value!.confirmReview();
    });
    expect(captured.value?.phase).toBe("idle");
  });
});
