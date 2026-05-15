import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { CaseScenarioProvider, ScenarioProvider } from "./ScenarioProvider";
import { useScenarioProductIncome } from "./useScenarioProductIncome";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

function RQ({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  queryClient.clear();
});

const baseScenario = {
  scenario_id: "s1",
  case_id: "c1",
  approach: "qualified_mortgage",
  pool_version: 1,
  status: "completed",
  created_at: null,
  rendering_hints: null,
} as any;

function makeComparison(overrides: Record<string, unknown> = {}) {
  return {
    scenario_id: "s1",
    approach: "qualified_mortgage",
    pool_version: 1,
    status: "completed",
    created_at: null,
    manifest_id: "m1",
    refinement_num: 0,
    results: [
      {
        result_id: "r1",
        spec_name: "fnma_w2_wages",
        spec_version: "1",
        spec_domain: "income",
        semantic_key: null,
        outcome: "eligible",
        monthly_amount: "5291.67",
        computed_at: null,
      },
      {
        result_id: "r2",
        spec_name: "fhlmc_k1",
        spec_version: "1",
        spec_domain: "income",
        semantic_key: null,
        outcome: "eligible",
        monthly_amount: "14388.33",
        computed_at: null,
      },
    ],
    product_specs: [
      {
        product_id: "fannie_mae",
        display_name: "Fannie Mae",
        agency: "fnma",
        spec_names: ["fnma_w2_wages"],
        total_monthly: 5291.67,
      },
      {
        product_id: "freddie_mac",
        display_name: "Freddie Mac",
        agency: "fhlmc",
        spec_names: ["fhlmc_k1"],
        total_monthly: 14388.33,
      },
    ],
    refinements: [],
    summary_result: {
      strategy: "max_value",
      value: 19680,
      groups: { fnma: 5291.67, fhlmc: 14388.33 },
      domain: "income",
      unit: "usd_per_month",
    },
    ...overrides,
  } as any;
}

function renderWithProviders(productId: string | null) {
  const captured: { value?: ReturnType<typeof useScenarioProductIncome> } = {};
  function Capture() {
    captured.value = useScenarioProductIncome(productId);
    return null;
  }
  render(
    <CaseScenarioProvider caseId="c1" scenarios={[makeComparison()]}>
      <ScenarioProvider scenarioId="s1" scenario={baseScenario} audit={[]}>
        <Capture />
      </ScenarioProvider>
    </CaseScenarioProvider>,
    { wrapper: RQ },
  );
  return captured.value!;
}

describe("useScenarioProductIncome", () => {
  it("matches a product_id and returns its spec results", () => {
    const r = renderWithProviders("fannie_mae");
    expect(r.productId).toBe("fannie_mae");
    expect(r.productSpec?.product_id).toBe("fannie_mae");
    expect(r.results).toHaveLength(1);
    expect(r.results[0]!.spec_name).toBe("fnma_w2_wages");
    expect(r.hasResult).toBe(true);
    expect(r.totalMonthly).toBe(5291.67);
  });

  it("aliases bank_statement → non_qm_bank_statement", () => {
    const r = renderWithProviders("bank_statement");
    expect(r.productId).toBe("non_qm_bank_statement");
    expect(r.productSpec).toBeNull();
    expect(r.hasResult).toBe(false);
  });

  it("returns hasResult=false when product not found in product_specs", () => {
    const r = renderWithProviders("usda");
    expect(r.productSpec).toBeNull();
    expect(r.results).toHaveLength(0);
    expect(r.hasResult).toBe(false);
    expect(r.summary?.value).toBe(19680);
  });

  it("returns null productId when input is null", () => {
    const r = renderWithProviders(null);
    expect(r.productId).toBeNull();
    expect(r.hasResult).toBe(false);
  });

  it("falls back to spec_name prefix when product_specs is empty", () => {
    const captured: { value?: ReturnType<typeof useScenarioProductIncome> } = {};
    function Capture() {
      captured.value = useScenarioProductIncome("fannie_mae");
      return null;
    }
    const emptyProductSpecsScenario = makeComparison({ product_specs: [] });
    render(
      <CaseScenarioProvider caseId="c1" scenarios={[emptyProductSpecsScenario]}>
        <ScenarioProvider scenarioId="s1" scenario={baseScenario} audit={[]}>
          <Capture />
        </ScenarioProvider>
      </CaseScenarioProvider>,
      { wrapper: RQ },
    );
    const r = captured.value!;
    expect(r.productSpec).toBeNull();
    expect(r.agency).toBe("fnma");
    expect(r.results).toHaveLength(1);
    expect(r.results[0]!.spec_name).toBe("fnma_w2_wages");
    expect(r.hasResult).toBe(true);
  });

  it("falls back to agency match when product_id is a variant slug", () => {
    // Veritas stored `fnma_selling_guide`, host route uses `fannie_mae`.
    const captured: { value?: ReturnType<typeof useScenarioProductIncome> } = {};
    function Capture() {
      captured.value = useScenarioProductIncome("fannie_mae");
      return null;
    }
    const variantScenario = makeComparison({
      product_specs: [
        {
          product_id: "fnma_selling_guide",
          display_name: "Fannie Mae",
          agency: "fnma",
          spec_names: ["fnma_w2_wages"],
          total_monthly: 5291.67,
        },
      ],
    });
    render(
      <CaseScenarioProvider caseId="c1" scenarios={[variantScenario]}>
        <ScenarioProvider scenarioId="s1" scenario={baseScenario} audit={[]}>
          <Capture />
        </ScenarioProvider>
      </CaseScenarioProvider>,
      { wrapper: RQ },
    );
    const r = captured.value!;
    expect(r.productSpec?.product_id).toBe("fnma_selling_guide");
    expect(r.agency).toBe("fnma");
    expect(r.hasResult).toBe(true);
    expect(r.results[0]!.spec_name).toBe("fnma_w2_wages");
  });
});
