import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { ScenarioCalcLogs } from "./ScenarioCalcLogs";
import { CaseScenarioProvider, ScenarioProvider } from "./ScenarioProvider";

const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function RQ({ children }: { children: ReactNode }) {
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
	queryClient.clear();
});

const audit = [
  {
    spec_name: "fnma_w2_wages_income",
    outcome: "pass",
    monthly_amount: 5000,
    steps: [
      {
        step_number: 1,
        derivation_name: "gross_wages",
        formula: "gross_wages / 12",
        formula_display: "Gross Wages / 12",
        result: 5000,
        is_final: true,
        function_calls: [],
      },
    ],
    proof_trace: [],
  },
  {
    spec_name: "freddie_mac_employment",
    outcome: "pass",
    monthly_amount: 0,
    steps: [],
    proof_trace: [],
  },
];

const scenario = {
  scenario_id: "s1", case_id: "c1", approach: "qm", pool_version: 1, status: "completed", created_at: null,
  rendering_hints: {
    is_non_qm: false, show_product_tabs: true,
    effective_product_ids: ["fannie_mae"], effective_borrower_ids: [], effective_document_ids: [],
    best_qualifying_income: 5000,
    approach_type: "qm_standard",
    product_specs: [{ product_id: "fannie_mae", display_name: "Fannie Mae", agency: "fnma", spec_names: ["fnma_w2_wages_income"], total_monthly: 5000 }],
    advice: [],
  },
};

describe("ScenarioCalcLogs", () => {
  it("filters audit by active product agency prefix", () => {
    render(
      <CaseScenarioProvider caseId="c1">
        <ScenarioProvider scenarioId="s1" scenario={scenario as any} audit={audit as any} initialProductId="fannie_mae">
          <ScenarioCalcLogs />
        </ScenarioProvider>
      </CaseScenarioProvider>,
      { wrapper: RQ },
    );
    expect(screen.getByText("fnma_w2_wages_income")).toBeTruthy();
    expect(screen.queryByText("freddie_mac_employment")).toBeNull();
  });

  it("renders 'unavailable' message when audit is empty", () => {
    render(
      <CaseScenarioProvider caseId="c1">
        <ScenarioProvider scenarioId="s1" scenario={scenario as any} audit={[]} initialProductId="fannie_mae">
          <ScenarioCalcLogs />
        </ScenarioProvider>
      </CaseScenarioProvider>,
      { wrapper: RQ },
    );
    expect(screen.getByText(/audit is still loading or unavailable/i)).toBeTruthy();
  });

  it("renders agency-specific empty state when audit has rows but none match the agency", () => {
    const offAgencyAudit = [{ ...audit[1], spec_name: "fha_w2_income" }];
    render(
      <CaseScenarioProvider caseId="c1">
        <ScenarioProvider
          scenarioId="s1"
          scenario={scenario as any}
          audit={offAgencyAudit as any}
          initialProductId="fannie_mae"
        >
          <ScenarioCalcLogs />
        </ScenarioProvider>
      </CaseScenarioProvider>,
      { wrapper: RQ },
    );
    expect(screen.getByText(/no calculation logs for fnma/i)).toBeTruthy();
  });
});
