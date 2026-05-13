import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ReactNode } from "react";
import { useCaseIdentities } from "./useCaseIdentities.js";
import { CaseScenarioProvider } from "../Scenario/ScenarioProvider.js";

vi.mock("@fenero/lux-core", async () => {
  const actual = await vi.importActual<typeof import("@fenero/lux-core")>("@fenero/lux-core");
  return {
    ...actual,
    getDefaultClient: () => mockClient,
  };
});

interface MockClient {
  getCaseEntities: ReturnType<typeof vi.fn>;
  getCaseScenarioRefinement: ReturnType<typeof vi.fn>;
}

const mockClient: MockClient = {
  getCaseEntities: vi.fn(),
  getCaseScenarioRefinement: vi.fn(),
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function RQ({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  queryClient.clear();
  mockClient.getCaseEntities.mockReset();
  mockClient.getCaseScenarioRefinement.mockReset();
});

function Probe({
  caseId,
  captured,
}: {
  caseId: string | null;
  captured: { value?: ReturnType<typeof useCaseIdentities> };
}) {
  captured.value = useCaseIdentities(caseId);
  return null;
}

describe("useCaseIdentities", () => {
  it("falls back to entities endpoint when no scenarios exist", async () => {
    mockClient.getCaseEntities.mockResolvedValue([
      {
        entity_group_id: "e1",
        case_id: "c1",
        entity_type: "person",
        identifier_type: "ssn_hash",
        identifier_value: "X",
        label: "Jane Borrower",
        resolution_method: "auto",
        status: "confirmed",
        doc_ids: [],
        parent_entity_group_id: null,
        borrower_identity_id: null,
      },
    ]);

    const captured: { value?: ReturnType<typeof useCaseIdentities> } = {};
    render(
      <RQ>
        <CaseScenarioProvider caseId="c1" scenarios={[]}>
          <Probe caseId="c1" captured={captured} />
        </CaseScenarioProvider>
      </RQ>,
    );

    await waitFor(() => {
      expect(captured.value?.rows.length).toBe(1);
    });
    expect(captured.value?.source).toBe("entities");
    expect(captured.value?.rows[0]).toMatchObject({
      id: "e1",
      name: "Jane Borrower",
      role: "borrower",
      entityType: "person",
      origin: "entities",
    });
    expect(mockClient.getCaseScenarioRefinement).not.toHaveBeenCalled();
  });

  it("prefers scenario refinement identities when available", async () => {
    mockClient.getCaseScenarioRefinement.mockResolvedValue({
      refinement_id: "r1",
      scenario_id: "s1",
      refinement_num: 0,
      identities: [
        {
          id: "i1",
          name: "Acme LLC",
          role: "employer",
          entity_type: "employer",
          status: "Included",
          borrower_class: "employer",
          needs_review: false,
        },
      ],
      documents: [],
      product_ids: [],
      specs_run: [],
      note: null,
      status: "completed",
      errors: [],
      name: null,
      total_monthly_income: null,
      summary_result: null,
      loan_product_ids: null,
    });
    mockClient.getCaseEntities.mockResolvedValue([]);

    const captured: { value?: ReturnType<typeof useCaseIdentities> } = {};
    render(
      <RQ>
        <CaseScenarioProvider
          caseId="c1"
          scenarios={
            [
              {
                scenario_id: "s1",
                approach: "qualified_mortgage",
                pool_version: 1,
                status: "completed",
                created_at: "2026-01-01T00:00:00Z",
                manifest_id: "m1",
                refinement_num: 0,
                results: [],
                product_specs: [],
                refinements: [
                  {
                    refinement_id: "r1",
                    scenario_id: "s1",
                    refinement_num: 0,
                    identities: [
                      {
                        id: "i1",
                        name: "Acme LLC",
                        role: "employer",
                        entity_type: "employer",
                        status: "Included",
                        borrower_class: "employer",
                        needs_review: false,
                      },
                    ],
                    documents: [],
                    product_ids: [],
                    specs_run: [],
                    note: null,
                    status: "completed",
                    errors: [],
                    name: null,
                    total_monthly_income: null,
                    summary_result: null,
                    loan_product_ids: null,
                  },
                ],
              },
            ] as never
          }
        >
          <Probe caseId="c1" captured={captured} />
        </CaseScenarioProvider>
      </RQ>,
    );

    await waitFor(() => {
      expect(captured.value?.rows.length).toBe(1);
    });
    expect(captured.value?.source).toBe("scenario");
    expect(captured.value?.rows[0]).toMatchObject({
      id: "i1",
      name: "Acme LLC",
      role: "employer",
      origin: "scenario",
    });
  });
});
