import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { toUserInputsPayload, useRefinementForm } from "./useRefinementForm.js";

const qmScenario = {
  scenario_id: "s1",
  case_id: "c1",
  approach: "qualified_mortgage",
  pool_version: null,
  status: "completed",
  created_at: null,
  rendering_hints: { effective_product_ids: ["fannie_mae"] },
} as never;

const nonQmBankScenario = {
  scenario_id: "s2",
  case_id: "c1",
  approach: "non_qualified_mortgage",
  pool_version: null,
  status: "completed",
  created_at: null,
  rendering_hints: { effective_product_ids: ["non_qm_bank_statement"] },
} as never;

describe("useRefinementForm", () => {
  it("resolves the product category from the scenario", () => {
    const { result } = renderHook(() =>
      useRefinementForm({ scenario: qmScenario }),
    );
    expect(result.current.productCategory).toBe("qm");
  });

  it("starts clean (not dirty) with empty seed and flips to dirty after a change", () => {
    const { result } = renderHook(() =>
      useRefinementForm({ scenario: qmScenario }),
    );
    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.setY1Override("2024");
    });
    expect(result.current.isDirty).toBe(true);
  });

  it("validation rejects identical tax-year overrides", () => {
    const { result } = renderHook(() =>
      useRefinementForm({ scenario: qmScenario }),
    );
    act(() => {
      result.current.setY1Override("2024");
      result.current.setY2Override("2024");
    });
    expect(result.current.validation.valid).toBe(false);
  });

  it("setUserInput merges then deletes when value is null", () => {
    const { result } = renderHook(() =>
      useRefinementForm({ scenario: nonQmBankScenario }),
    );
    act(() => {
      result.current.setUserInput("expense_factor", 0.5);
    });
    expect(result.current.state.userInputs.expense_factor).toBe(0.5);
    act(() => {
      result.current.setUserInput("expense_factor", null);
    });
    expect(result.current.state.userInputs.expense_factor).toBeUndefined();
  });

  it("reset() returns to the baseline (clearing in-flight edits)", () => {
    const { result } = renderHook(() =>
      useRefinementForm({ scenario: qmScenario }),
    );
    act(() => {
      result.current.setY1Override("2024");
    });
    expect(result.current.isDirty).toBe(true);
    act(() => {
      result.current.reset();
    });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.state.y1Override).toBeNull();
  });

  it("isDirty distinguishes order-independent selection changes", () => {
    const { result } = renderHook(() =>
      useRefinementForm({ scenario: qmScenario, seed: { borrowerIds: ["a", "b"] } }),
    );
    expect(result.current.isDirty).toBe(false);
    act(() => {
      result.current.setBorrowers(["b", "a"]); // order swap == not dirty
    });
    expect(result.current.isDirty).toBe(false);
    act(() => {
      result.current.setBorrowers(["a"]); // actual change
    });
    expect(result.current.isDirty).toBe(true);
  });
});

describe("toUserInputsPayload", () => {
  it("returns null when no override fields are set", () => {
    expect(
      toUserInputsPayload({
        selectedBorrowerIds: [],
        selectedDocumentIds: [],
        selectedProductIds: [],
        y1Override: null,
        y2Override: null,
        statementPeriodMonths: null,
        userInputs: {},
        note: "",
        extractionEditCount: 0,
      }),
    ).toBeNull();
  });

  it("packs y1/y2 and merges with arbitrary userInputs", () => {
    const payload = toUserInputsPayload({
      selectedBorrowerIds: [],
      selectedDocumentIds: [],
      selectedProductIds: [],
      y1Override: "2024",
      y2Override: "2023",
      statementPeriodMonths: null,
      userInputs: { expense_factor: 0.3 },
      note: "",
      extractionEditCount: 0,
    });
    expect(payload).toEqual({
      y1_override: "2024",
      y2_override: "2023",
      expense_factor: 0.3,
    });
  });

  it("packs statement_period_months for Non-QM bank statement", () => {
    expect(
      toUserInputsPayload({
        selectedBorrowerIds: [],
        selectedDocumentIds: [],
        selectedProductIds: [],
        y1Override: null,
        y2Override: null,
        statementPeriodMonths: 12,
        userInputs: {},
        note: "",
        extractionEditCount: 0,
      }),
    ).toEqual({ statement_period_months: 12 });
  });
});
