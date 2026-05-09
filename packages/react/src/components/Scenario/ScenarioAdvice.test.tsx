import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("../../providers/OperatorProvider.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../providers/OperatorProvider")>();
  return {
    ...actual,
    useOperatorClient: () => ({
      getCaseScenarioAdvice: vi.fn().mockResolvedValue({ items: [], narrative: null }),
    }),
  };
});

import { ScenarioAdvice } from "./ScenarioAdvice";
import { CaseScenarioProvider, ScenarioProvider } from "./ScenarioProvider";

const makeScenarioWithAdvice = (advice: any[]) => ({
  scenario_id: "s1", case_id: "c1", approach: "qm", pool_version: 1, status: "completed", created_at: null,
  rendering_hints: {
    is_non_qm: false, show_product_tabs: true,
    effective_product_ids: [], effective_borrower_ids: [], effective_document_ids: [],
    best_qualifying_income: null, approach_type: "qm_standard",
    product_specs: [], advice,
  },
});

const Wrapper = ({ scenario, children }: any) => (
  <CaseScenarioProvider caseId="c1">
    <ScenarioProvider scenarioId="s1" scenario={scenario}>{children}</ScenarioProvider>
  </CaseScenarioProvider>
);

describe("ScenarioAdvice", () => {
  it("renders nothing when advice is empty", () => {
    const { container } = render(
      <Wrapper scenario={makeScenarioWithAdvice([])}><ScenarioAdvice onAction={vi.fn()} /></Wrapper>
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders advice items from rendering_hints", () => {
    const advice = [{ code: "single_year_data", severity: "warning", message: "Upload prior year.", action: null, action_label: null, detail: null }];
    render(
      <Wrapper scenario={makeScenarioWithAdvice(advice)}><ScenarioAdvice onAction={vi.fn()} /></Wrapper>
    );
    expect(screen.getByText("Upload prior year.")).toBeTruthy();
  });
});
