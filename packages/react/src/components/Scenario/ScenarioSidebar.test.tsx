import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ScenarioSidebar } from "./ScenarioSidebar";
import { CaseScenarioProvider } from "./ScenarioProvider";

const scenarios = [
  { scenario_id: "s1", approach: "qualified_mortgage", status: "completed", refinement_num: 2, results: [{ spec_name: "fnma_w2", monthly_amount: 5000, outcome: "pass", computed_at: null }], rendering_hints: null },
  { scenario_id: "s2", approach: "non_qualified_mortgage", status: "running", refinement_num: 0, results: [], rendering_hints: null },
];

describe("ScenarioSidebar", () => {
  it("renders scenario cards", () => {
    const onSelect = vi.fn();
    render(
      <CaseScenarioProvider caseId="c1" scenarios={scenarios as any}>
        <ScenarioSidebar activeScenarioId="s1" onSelectScenario={onSelect} />
      </CaseScenarioProvider>
    );
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(2);
  });

  it("calls onSelectScenario when a scenario is clicked", () => {
    const onSelect = vi.fn();
    render(
      <CaseScenarioProvider caseId="c1" scenarios={scenarios as any}>
        <ScenarioSidebar activeScenarioId="s1" onSelectScenario={onSelect} />
      </CaseScenarioProvider>
    );
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(onSelect).toHaveBeenCalled();
  });
});
