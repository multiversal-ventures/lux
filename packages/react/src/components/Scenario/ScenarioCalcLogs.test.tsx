import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ScenarioCalcLogs } from "./ScenarioCalcLogs";
import { CaseScenarioProvider, ScenarioProvider } from "./ScenarioProvider";

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
      </CaseScenarioProvider>
    );
    expect(screen.getByText("fnma_w2_wages_income")).toBeTruthy();
    expect(screen.queryByText("freddie_mac_employment")).toBeNull();
  });

  it("renders empty state when no specs match", () => {
    render(
      <CaseScenarioProvider caseId="c1">
        <ScenarioProvider scenarioId="s1" scenario={scenario as any} audit={[]} initialProductId="fannie_mae">
          <ScenarioCalcLogs />
        </ScenarioProvider>
      </CaseScenarioProvider>
    );
    expect(screen.getByText(/no calculation/i)).toBeTruthy();
  });
});
