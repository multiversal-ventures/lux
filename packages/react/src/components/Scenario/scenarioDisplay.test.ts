import { describe, it, expect } from "vitest";
import {
  formatRefinementDisplayName,
  formatRefinementRowTitle,
  formatRefinementSubtitle,
  formatScenarioListHeadline,
  resolveScenarioDisplayName,
} from "./scenarioDisplay.js";

describe("scenarioDisplay", () => {
  it("resolveScenarioDisplayName prefers name", () => {
    expect(
      resolveScenarioDisplayName({
        scenario_id: "x",
        approach: "qualified_mortgage",
        name: "  My scenario  ",
        pool_version: null,
        status: "completed",
        created_at: null,
        manifest_id: null,
        refinement_num: null,
        results: [],
        product_specs: [],
        refinements: [],
      } as never),
    ).toBe("My scenario");
  });

  it("formatScenarioListHeadline appends run index", () => {
    const row = {
      scenario_id: "x",
      approach: "qualified_mortgage",
      name: null,
      pool_version: null,
      status: "completed",
      created_at: null,
      manifest_id: null,
      refinement_num: null,
      results: [],
      product_specs: [],
      refinements: [],
    } as never;
    expect(formatScenarioListHeadline(row, 3)).toBe("Qualified Mortgage — Run 3");
  });

  it("formatRefinementSubtitle uses note when name missing", () => {
    expect(
      formatRefinementSubtitle({
        refinement_id: "r",
        scenario_id: "s",
        refinement_num: 0,
        identities: [],
        documents: [],
        product_ids: [],
        specs_run: [],
        note: "First line\nSecond",
        name: null,
        errors: [],
      } as never),
    ).toBe("First line");
  });

  it("formatRefinementRowTitle avoids duplicating Run #", () => {
    expect(
      formatRefinementRowTitle({
        refinement_id: "r",
        scenario_id: "s",
        refinement_num: 0,
        identities: [],
        documents: [],
        product_ids: [],
        specs_run: [],
        note: null,
        name: null,
        errors: [],
      } as never),
    ).toBe("Run #0 — Untitled refinement");
  });

  it("formatRefinementDisplayName falls back to Run # when alone", () => {
    expect(
      formatRefinementDisplayName({
        refinement_id: "r",
        scenario_id: "s",
        refinement_num: 2,
        identities: [],
        documents: [],
        product_ids: [],
        specs_run: [],
        note: null,
        name: null,
        errors: [],
      } as never),
    ).toBe("Run #2");
  });
});
