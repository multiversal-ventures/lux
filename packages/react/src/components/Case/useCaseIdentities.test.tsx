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
    // The backend now ships both the display label (``role``) and the
    // stable slug (``role_hint``) on every IdentityInfo, so the hook
    // doesn't need a local normalisation table.
    mockClient.getCaseIdentities.mockResolvedValue([
      {
        id: "e1",
        name: "Jane Borrower",
        role: "Borrower",
        role_hint: "taxpayer",
        entity_type: null,
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
    // ``role`` is the API's stable slug (``role_hint``); the display
    // label lives on ``roleLabel`` so the picker can render the badge
    // without re-deriving anything.
    expect(captured.value?.rows[0]).toMatchObject({
      id: "e1",
      name: "Jane Borrower",
      role: "taxpayer",
      roleLabel: "Borrower",
      // Person rows have no ``entity_type``; we fall back to the
      // borrower_class so the Type column / filter still has something.
      entityType: "borrower",
      origin: "case",
    });
    expect(mockClient.getCaseIdentities).toHaveBeenCalledWith("c1", undefined);
  });

  it("falls back to borrower_class when role_hint is absent", async () => {
    // Financial-institution shims have neither a role_hint nor a curated
    // display role. The hook still has to produce a non-empty slug so
    // the picker's filter dropdown can group them.
    mockClient.getCaseIdentities.mockResolvedValue([
      {
        id: "bank-1",
        name: "Acme Bank",
        role: null,
        role_hint: null,
        entity_type: "Financial Institution",
        status: "Included",
        borrower_class: "financial_institution",
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
    expect(captured.value?.rows[0]).toMatchObject({
      id: "bank-1",
      role: "financial_institution",
      roleLabel: "",
      entityType: "Financial Institution",
    });
  });

  it("forwards scenarioId to the client and caches it separately", async () => {
    // Scenario-pinned response (DSCR shape: property primary + folded landlords).
    mockClient.getCaseIdentities.mockResolvedValue([
      {
        id: "prop-1",
        name: "10540 Windsor Park Drive",
        role: "Subject Property",
        role_hint: null,
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
    // Display-ready entity_type passes through verbatim — no lowercasing,
    // no humanizer. The backend's display_labels registry is the only
    // place that decides on the rendering ("Subject Property", not
    // "subject property").
    expect(captured.value?.rows[0]).toMatchObject({
      id: "prop-1",
      entityType: "Subject Property",
      roleLabel: "Subject Property",
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
