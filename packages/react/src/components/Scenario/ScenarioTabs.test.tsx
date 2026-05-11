import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { ScenarioTabs } from "./ScenarioTabs";
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

const makeScenario = (approachType = "qm_standard", products: any[] = []) => ({
  scenario_id: "s1",
  case_id: "c1",
  approach: "qualified_mortgage",
  pool_version: 1,
  status: "completed",
  created_at: null,
  rendering_hints: {
    is_non_qm: false,
    show_product_tabs: true,
    effective_product_ids: products.map((p) => p.product_id),
    effective_borrower_ids: [],
    effective_document_ids: [],
    best_qualifying_income: null,
    approach_type: approachType,
    product_specs: products,
    advice: [],
  },
});

const Wrapper = ({ scenario, children }: any) => (
  <CaseScenarioProvider caseId="c1">
    <ScenarioProvider scenarioId="s1" scenario={scenario} audit={[]}>
      {children}
    </ScenarioProvider>
  </CaseScenarioProvider>
);

describe("ScenarioTabs", () => {
  it("renders product tabs for qm_standard", () => {
    const scenario = makeScenario("qm_standard", [
      { product_id: "fannie_mae", display_name: "Fannie Mae", agency: "fnma", spec_names: [], total_monthly: null },
    ]);
    render(<Wrapper scenario={scenario}><ScenarioTabs /></Wrapper>, { wrapper: RQ });
    expect(screen.getByText("Summary")).toBeTruthy();
    expect(screen.getByText("Fannie Mae")).toBeTruthy();
  });

  it("renders only Summary tab for non_qm_bank_statement", () => {
    const scenario = makeScenario("non_qm_bank_statement", []);
    render(<Wrapper scenario={scenario}><ScenarioTabs /></Wrapper>, { wrapper: RQ });
    expect(screen.getByText("Summary")).toBeTruthy();
    expect(screen.queryByText("Fannie Mae")).toBeNull();
  });

  it("falls back to Summary-only for unknown approach_type", () => {
    const scenario = makeScenario("future_unknown_type", [
      { product_id: "p1", display_name: "Product 1", agency: "p1", spec_names: [], total_monthly: null },
    ]);
    render(<Wrapper scenario={scenario}><ScenarioTabs /></Wrapper>, { wrapper: RQ });
    expect(screen.getByText("Summary")).toBeTruthy();
    expect(screen.queryByText("Product 1")).toBeNull();
  });

  it("invokes onTabNavigate for Summary and product tabs", async () => {
    const user = userEvent.setup();
    const onTabNavigate = vi.fn();
    const scenario = makeScenario("qm_standard", [
      { product_id: "fannie_mae", display_name: "Fannie Mae", agency: "fnma", spec_names: [], total_monthly: null },
    ]);
    render(
      <Wrapper scenario={scenario}>
        <ScenarioTabs onTabNavigate={onTabNavigate} />
      </Wrapper>,
      { wrapper: RQ },
    );
    await user.click(screen.getByRole("button", { name: "Summary" }));
    expect(onTabNavigate).toHaveBeenLastCalledWith("summary");
    await user.click(screen.getByRole("button", { name: "Fannie Mae" }));
    expect(onTabNavigate).toHaveBeenLastCalledWith("fannie_mae");
  });
});
