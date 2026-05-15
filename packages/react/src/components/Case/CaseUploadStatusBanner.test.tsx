import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { CaseWorkflowProvider } from "./CaseWorkflowProvider.js";
import { CaseUploadStatusBanner } from "./CaseUploadStatusBanner.js";
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

describe("CaseUploadStatusBanner", () => {
  it("renders nothing in the idle phase by default", () => {
    const { container } = render(
      <Wrapper caseId="c-banner-idle">
        <CaseUploadStatusBanner />
      </Wrapper>,
    );
    // No banner content rendered.
    expect(container.textContent ?? "").toBe("");
  });

  it("renders the extracting state when the store says so", async () => {
    let advance: (() => void) | null = null;
    function Bridge() {
      const flow = useCaseUploadFlow();
      advance = () => {
        flow.beginUpload({ fileNames: ["a.pdf"], currentDocIds: [] });
        flow.markExtracting();
      };
      return null;
    }

    const { findByText } = render(
      <Wrapper caseId="c-banner-extract">
        <Bridge />
        <CaseUploadStatusBanner />
      </Wrapper>,
    );

    await act(async () => {
      advance!();
    });
    expect(await findByText(/Extracting/i)).toBeTruthy();
  });

  it("invokes onConfirm with newDocuments and then collapses to idle", async () => {
    const onConfirm = vi.fn();
    let advance: (() => void) | null = null;
    function Bridge() {
      const flow = useCaseUploadFlow();
      advance = () => {
        flow.beginUpload({ fileNames: ["a.pdf"], currentDocIds: ["existing"] });
        flow.markReviewing();
      };
      return null;
    }

    const { getByText, container } = render(
      <Wrapper caseId="c-banner-review">
        <Bridge />
        <CaseUploadStatusBanner onConfirm={onConfirm} />
      </Wrapper>,
    );

    await act(async () => {
      advance!();
    });

    const confirmBtn = getByText(/Add to scenario/i);
    await act(async () => {
      confirmBtn.click();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(container.textContent ?? "").toBe("");
  });
});
