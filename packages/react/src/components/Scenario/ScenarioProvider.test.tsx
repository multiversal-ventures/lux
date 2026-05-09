import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CaseScenarioProvider, useCaseScenarioContext, ScenarioProvider, useScenarioContext } from "./ScenarioProvider";

describe("useCaseScenarioContext", () => {
  it("throws when used outside CaseScenarioProvider", () => {
    const Consumer = () => { useCaseScenarioContext(); return null; };
    expect(() => render(<Consumer />)).toThrow("CaseScenarioProvider required");
  });

  it("provides caseId to consumers", () => {
    const Consumer = () => {
      const ctx = useCaseScenarioContext();
      return <span>{ctx.caseId}</span>;
    };
    render(
      <CaseScenarioProvider caseId="case-1">
        <Consumer />
      </CaseScenarioProvider>
    );
    expect(screen.getByText("case-1")).toBeTruthy();
  });
});

describe("useScenarioContext", () => {
  it("throws when used outside ScenarioProvider", () => {
    const Consumer = () => { useScenarioContext(); return null; };
    expect(() => render(<Consumer />)).toThrow("ScenarioProvider required");
  });

  it("exposes caseId from outer CaseScenarioProvider", () => {
    const scenario = {
      scenario_id: "s1",
      case_id: "c1",
      approach: "qualified_mortgage",
      pool_version: 1,
      status: "completed",
      created_at: null,
      rendering_hints: null,
    } as any;

    const Consumer = () => {
      const ctx = useScenarioContext();
      return <span>{ctx.caseId}</span>;
    };

    render(
      <CaseScenarioProvider caseId="case-42">
        <ScenarioProvider scenarioId="s1" scenario={scenario}>
          <Consumer />
        </ScenarioProvider>
      </CaseScenarioProvider>
    );
    expect(screen.getByText("case-42")).toBeTruthy();
  });
});
