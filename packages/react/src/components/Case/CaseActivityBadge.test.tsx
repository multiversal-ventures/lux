import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { CaseWorkflowProvider } from "./CaseWorkflowProvider.js";
import { CaseActivityBadge } from "./CaseActivityBadge.js";
import { useCaseUploadFlow } from "./useCaseUploadFlow.js";

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

beforeEach(() => {
  qc.clear();
  mockClient.getCaseDocuments.mockResolvedValue([]);
  mockClient.getCaseFiles.mockResolvedValue([]);
});

describe("CaseActivityBadge", () => {
  it("renders nothing when the flow is idle", () => {
    const { container } = render(
      <Wrapper caseId="c-idle">
        <CaseActivityBadge />
      </Wrapper>,
    );
    expect(container.textContent ?? "").toBe("");
  });

  it("renders state set in one component when read from another (cross-component sharing)", async () => {
    // Component A dispatches into the workflow store. Component B (the
    // badge) reads from the SAME store via the surrounding provider. This
    // is the exact pattern the sidebar + create-scenario page rely on.
    let dispatchUpload: (() => void) | null = null;
    function Dispatcher() {
      const flow = useCaseUploadFlow();
      dispatchUpload = () =>
        flow.beginUpload({ fileNames: ["a.pdf", "b.pdf"], currentDocIds: [] });
      return null;
    }

    const { findByText } = render(
      <Wrapper caseId="c-cross">
        <Dispatcher />
        <CaseActivityBadge />
      </Wrapper>,
    );

    await act(async () => {
      dispatchUpload!();
    });
    expect(await findByText(/Uploading 2 files/i)).toBeTruthy();
  });

  it("supports slot overrides for each phase", async () => {
    let advance: (() => void) | null = null;
    function Bridge() {
      const flow = useCaseUploadFlow();
      advance = () => {
        flow.beginUpload({ fileNames: ["only.pdf"], currentDocIds: [] });
        flow.markExtracting();
      };
      return null;
    }

    const { findByText } = render(
      <Wrapper caseId="c-slots">
        <Bridge />
        <CaseActivityBadge
          slots={{
            extracting: ({ fileCount }) => <span>HOST-EXTRACTING-{fileCount}</span>,
          }}
        />
      </Wrapper>,
    );

    await act(async () => {
      advance!();
    });
    expect(await findByText("HOST-EXTRACTING-1")).toBeTruthy();
  });
});
