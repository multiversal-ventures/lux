import { render, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { CaseScenarioProvider, ScenarioProvider } from "./ScenarioProvider.js";
import { ScenarioRunningPanel } from "./ScenarioRunningPanel.js";
import { getScenarioRunsStore } from "../../state/scenarioRunsStore.js";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const baseScenarioDetail = {
  scenario_id: "s1",
  case_id: "c1",
  approach: "non_qualified_mortgage",
  pool_version: 1,
  status: "completed",
  created_at: null,
  rendering_hints: {
    is_non_qm: true,
    show_product_tabs: true,
    effective_product_ids: ["irs_1099_income"],
    effective_borrower_ids: [],
    effective_document_ids: [],
    best_qualifying_income: null,
    approach_type: "non_qm_1099",
    product_specs: [],
    advice: [],
  },
};

function makeScenarioRow(overrides: { status?: string; refinements?: { status?: string; refinement_num?: number; note?: string }[] } = {}) {
  return {
    scenario_id: "s1",
    case_id: "c1",
    approach: "non_qualified_mortgage",
    pool_version: 1,
    status: overrides.status ?? "completed",
    created_at: null,
    refinements: (overrides.refinements ?? []).map((r) => ({
      refinement_id: `r-${r.refinement_num ?? 0}`,
      scenario_id: "s1",
      refinement_num: r.refinement_num ?? 0,
      identities: [],
      documents: [],
      product_ids: ["irs_1099_income"],
      specs_run: [],
      note: r.note ?? null,
      status: r.status ?? "completed",
      errors: [],
      name: null,
      total_monthly_income: null,
      summary_result: null,
      loan_product_ids: null,
      context: null,
      user_inputs_schema: null,
    })),
  };
}

function Wrap({ children, scenarios }: { children: ReactNode; scenarios: any[] }) {
  return (
    <QueryClientProvider client={queryClient}>
      <CaseScenarioProvider caseId="c1" scenarios={scenarios}>
        <ScenarioProvider scenarioId="s1" scenario={baseScenarioDetail as never} audit={[]}>
          {children}
        </ScenarioProvider>
      </CaseScenarioProvider>
    </QueryClientProvider>
  );
}

describe("ScenarioRunningPanel", () => {
  beforeEach(() => {
    getScenarioRunsStore().getState().reset();
    queryClient.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    getScenarioRunsStore().getState().reset();
  });

  it("renders children when nothing is running", () => {
    const scenarios = [makeScenarioRow({ status: "completed", refinements: [{ status: "completed", refinement_num: 0 }] })];
    const { getByText, queryByRole } = render(
      <Wrap scenarios={scenarios}>
        <ScenarioRunningPanel>
          <div>idle results</div>
        </ScenarioRunningPanel>
      </Wrap>,
    );
    expect(getByText("idle results")).toBeTruthy();
    expect(queryByRole("status")).toBeNull();
  });

  it("renders the loader when the latest refinement is running", () => {
    const scenarios = [
      makeScenarioRow({
        // Scenario status running so pulse / status checks both flag running.
        status: "running",
        refinements: [{ status: "running", refinement_num: 1, note: "expense factor change" }],
      }),
    ];
    const { getByRole, getByText, queryByText } = render(
      <Wrap scenarios={scenarios}>
        <ScenarioRunningPanel>
          <div>idle results</div>
        </ScenarioRunningPanel>
      </Wrap>,
    );
    expect(getByRole("status")).toBeTruthy();
    expect(getByText(/Calculating income/i)).toBeTruthy();
    // The "run #N — note" meta line is intentionally suppressed —
    // refinement_num=0 / placeholder notes ("CLI qualify run") were
    // creative-writing exercise rather than signal.
    expect(queryByText(/run #1/i)).toBeNull();
    expect(queryByText(/expense factor change/i)).toBeNull();
  });

  it("collapses the loader when the scenario reaches completed even if the pulse is fresh", () => {
    // Models the bug where a scenario finished server-side but the
    // refinement carried no status (no spec_results joined) so the
    // pulse pinned the loader for 60s. The scenarioTerminal guard in
    // useScenarioRunningState now suppresses the pulse on either
    // signal — scenario or refinement.
    const scenarios = [
      makeScenarioRow({ status: "completed", refinements: [{ status: undefined as never, refinement_num: 0 }] }),
    ];
    act(() => {
      getScenarioRunsStore().getState().markJustStarted("s1");
    });
    const { getByText } = render(
      <Wrap scenarios={scenarios}>
        <ScenarioRunningPanel>
          <div>idle results</div>
        </ScenarioRunningPanel>
      </Wrap>,
    );
    expect(getByText("idle results")).toBeTruthy();
  });

  it("renders the loader when the scenario row itself is pending", () => {
    const scenarios = [makeScenarioRow({ status: "pending" })];
    const { getByText } = render(
      <Wrap scenarios={scenarios}>
        <ScenarioRunningPanel>
          <div>idle results</div>
        </ScenarioRunningPanel>
      </Wrap>,
    );
    expect(getByText(/Queued/i)).toBeTruthy();
  });

  it("renders the loader from a just-started pulse before the server confirms", () => {
    const scenarios = [makeScenarioRow({ status: "completed", refinements: [{ status: "completed", refinement_num: 0 }] })];
    // Simulate Save & Run — pulse the just-started flag.
    act(() => {
      getScenarioRunsStore().getState().markJustStarted("s1");
    });
    // Wait for the server to confirm: refinements list still shows
    // completed, but the pulse should keep the loader visible.
    const { getByRole, getByText } = render(
      <Wrap scenarios={scenarios}>
        <ScenarioRunningPanel>
          <div>idle results</div>
        </ScenarioRunningPanel>
      </Wrap>,
    );
    // BUG GUARD: the pulse must NOT pin the loader when the latest
    // refinement is already terminal (completed/failed) — that would
    // mean a quick run that finished inside the TTL would still hide
    // results. Verify it correctly shows IDLE in that case.
    expect(getByText("idle results")).toBeTruthy();
    expect(() => getByRole("status")).toThrow();
  });

  it("just-started pulse wins when neither scenario nor refinements have settled", () => {
    // No refinements yet AND scenario status hasn't transitioned to
    // a terminal state. The pulse is the only running signal and must
    // pin the loader. Models the moment immediately after Save & Run
    // when the API has accepted the request but the scenarios query
    // hasn't refetched the new running scenario.
    const scenarios = [
      makeScenarioRow({ status: "running", refinements: [] }),
    ];
    act(() => {
      getScenarioRunsStore().getState().markJustStarted("s1");
    });
    const { getByText } = render(
      <Wrap scenarios={scenarios}>
        <ScenarioRunningPanel>
          <div>idle results</div>
        </ScenarioRunningPanel>
      </Wrap>,
    );
    // Server says "running" too, so the headline is "Calculating income".
    expect(getByText(/Calculating income/i)).toBeTruthy();
  });
});
