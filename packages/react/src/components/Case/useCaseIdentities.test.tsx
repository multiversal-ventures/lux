import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ReactNode } from "react";
import { useCaseIdentities } from "./useCaseIdentities.js";

vi.mock("@multiversal-ventures/lux-core", async () => {
  const actual = await vi.importActual<typeof import("@multiversal-ventures/lux-core")>("@multiversal-ventures/lux-core");
  return {
    ...actual,
    getDefaultClient: () => mockClient,
  };
});

interface MockClient {
  getCaseIdentities: ReturnType<typeof vi.fn>;
}

const mockClient: MockClient = {
  getCaseIdentities: vi.fn(),
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function RQ({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  queryClient.clear();
  mockClient.getCaseIdentities.mockReset();
});

function Probe({
  caseId,
  scenarioId,
  captured,
}: {
  caseId: string | null;
  scenarioId?: string | null;
  captured: { value?: ReturnType<typeof useCaseIdentities> };
}) {
  captured.value = useCaseIdentities(
    caseId,
    scenarioId === undefined ? {} : { scenarioId },
  );
  return null;
}

describe("useCaseIdentities", () => {
  it("loads identities from the unified /identities endpoint", async () => {
    mockClient.getCaseIdentities.mockResolvedValue([
      {
        id: "e1",
        name: "Jane Borrower",
        role: "taxpayer",
        entity_type: "person",
        status: "Included",
        borrower_class: "borrower",
        needs_review: false,
      },
    ]);

    const captured: { value?: ReturnType<typeof useCaseIdentities> } = {};
    render(
      <RQ>
        <Probe caseId="c1" captured={captured} />
      </RQ>,
    );

    await waitFor(() => {
      expect(captured.value?.rows.length).toBe(1);
    });
    expect(captured.value?.source).toBe("case");
    expect(captured.value?.rows[0]).toMatchObject({
      id: "e1",
      name: "Jane Borrower",
      role: "borrower",
      entityType: "person",
      origin: "case",
    });
    expect(mockClient.getCaseIdentities).toHaveBeenCalledWith("c1", undefined);
  });

  it("forwards scenarioId to the client and caches it separately", async () => {
    // Scenario-pinned response (DSCR shape: property primary + folded landlords).
    mockClient.getCaseIdentities.mockResolvedValue([
      {
        id: "prop-1",
        name: "10540 Windsor Park Drive",
        role: "Subject Property",
        entity_type: "Subject Property",
        status: "Included",
        borrower_class: "borrower",
        needs_review: false,
      },
    ]);

    const captured: { value?: ReturnType<typeof useCaseIdentities> } = {};
    render(
      <RQ>
        <Probe caseId="c1" scenarioId="s1" captured={captured} />
      </RQ>,
    );

    await waitFor(() => {
      expect(captured.value?.rows.length).toBe(1);
    });

    // Hook must thread the scenarioId option into the client call so the
    // backend applies the scenario's borrower assembly.
    expect(mockClient.getCaseIdentities).toHaveBeenCalledWith("c1", { scenarioId: "s1" });
    expect(captured.value?.rows[0]).toMatchObject({
      id: "prop-1",
      entityType: "subject property",
    });
  });

  it("returns empty source when no identities are returned", async () => {
    mockClient.getCaseIdentities.mockResolvedValue([]);

    const captured: { value?: ReturnType<typeof useCaseIdentities> } = {};
    render(
      <RQ>
        <Probe caseId="c1" captured={captured} />
      </RQ>,
    );

    await waitFor(() => {
      expect(captured.value?.isLoading).toBe(false);
    });
    expect(captured.value?.source).toBe("empty");
    expect(captured.value?.rows).toHaveLength(0);
  });
});
