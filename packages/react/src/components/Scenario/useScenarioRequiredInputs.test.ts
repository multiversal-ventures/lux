/**
 * Tests for ``useScenarioRequiredInputs``.
 *
 * The ``missingProducts`` / ``hasMissing`` detection logic is the key behaviour
 * being tested here. The ``inputs`` / ``errors`` / ``isValid`` / ``context``
 * tuple is exercised through the hook's seeding and validation paths.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useScenarioRequiredInputs } from "./useScenarioRequiredInputs.js";
import type { TenantProduct } from "../Case/useTenantProducts.js";
import type { RefinementContext } from "../Refinement/DynamicUserInputsForm.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

type Field = TenantProduct["initial_required_inputs"][number];

function makeField(name: string, overrides: Partial<Field> = {}): Field {
  return {
    name,
    type: "number",
    label: name,
    hint: null,
    default: null,
    required: true,
    required_at_create: true,
    minimum: null,
    maximum: null,
    step: null,
    unit: null,
    options: [],
    derive_options_from: null,
    spec_name: "test_spec",
    ...overrides,
  };
}

function makeProduct(
  productId: string,
  fields: Field[] = [],
  overrides: Partial<TenantProduct> = {},
): TenantProduct {
  return {
    product_id: productId,
    display_name: productId,
    agency: "TEST",
    agency_path: "dscr_multiple_entities",
    description: null,
    spec_filter: [],
    income_document_types: [],
    credit_document_types: [],
    default_calculation_track: null,
    config: {},
    enabled: true,
    is_default: false,
    sort_order: 0,
    groups: [],
    initial_required_inputs: fields,
    ...overrides,
  };
}

const DSCR_FIELDS = [
  makeField("proposed_loan_amount"),
  makeField("proposed_annual_rate"),
  makeField("proposed_term_months"),
];

const dscrProduct = makeProduct("dscr", DSCR_FIELDS);
const qmProduct = makeProduct("fannie_mae", []); // no required inputs

// ─── Detection tests ──────────────────────────────────────────────────────────

describe("useScenarioRequiredInputs — detection", () => {
  it("hasMissing=true when existingContext is null and product has required fields", () => {
    const { result } = renderHook(() =>
      useScenarioRequiredInputs([dscrProduct], ["dscr"], null),
    );
    expect(result.current.hasMissing).toBe(true);
    expect(result.current.missingProducts).toHaveLength(1);
    expect(result.current.missingProducts[0].product.product_id).toBe("dscr");
  });

  it("hasMissing=false when all required fields are present in existingContext", () => {
    const existingContext: RefinementContext = {
      dscr: {
        inputs: {
          proposed_loan_amount: 500000,
          proposed_annual_rate: 0.07,
          proposed_term_months: 360,
        },
      },
    };
    const { result } = renderHook(() =>
      useScenarioRequiredInputs([dscrProduct], ["dscr"], existingContext),
    );
    expect(result.current.hasMissing).toBe(false);
    expect(result.current.missingProducts).toHaveLength(0);
  });

  it("hasMissing=true when only some fields are present in existingContext", () => {
    const existingContext: RefinementContext = {
      dscr: {
        inputs: {
          proposed_loan_amount: 500000,
          // missing proposed_annual_rate and proposed_term_months
        },
      },
    };
    const { result } = renderHook(() =>
      useScenarioRequiredInputs([dscrProduct], ["dscr"], existingContext),
    );
    expect(result.current.hasMissing).toBe(true);
    expect(result.current.missingProducts[0].fields).toHaveLength(3);
  });

  it("hasMissing=false for products with no initial_required_inputs", () => {
    const { result } = renderHook(() =>
      useScenarioRequiredInputs([qmProduct], ["fannie_mae"], null),
    );
    expect(result.current.hasMissing).toBe(false);
    expect(result.current.missingProducts).toHaveLength(0);
  });

  it("only reports missing for products in selectedProductIds", () => {
    const { result } = renderHook(() =>
      // dscr is in catalog but not selected
      useScenarioRequiredInputs([dscrProduct, qmProduct], ["fannie_mae"], null),
    );
    expect(result.current.hasMissing).toBe(false);
  });
});

// ─── Pre-fill tests ───────────────────────────────────────────────────────────

describe("useScenarioRequiredInputs — pre-fill", () => {
  it("seeds form inputs from existingContext", () => {
    const existingContext: RefinementContext = {
      dscr: {
        inputs: {
          proposed_loan_amount: 750000,
          proposed_annual_rate: 0.065,
        },
      },
    };
    const { result } = renderHook(() =>
      useScenarioRequiredInputs([dscrProduct], ["dscr"], existingContext),
    );
    expect(result.current.inputs["dscr"]?.proposed_loan_amount).toBe(750000);
    expect(result.current.inputs["dscr"]?.proposed_annual_rate).toBe(0.065);
  });

  it("seeds YAML defaults for fields not in existingContext", () => {
    const fieldWithDefault = makeField("proposed_term_months", { default: 360 });
    const productWithDefault = makeProduct("dscr", [
      makeField("proposed_loan_amount"),
      fieldWithDefault,
    ]);
    const { result } = renderHook(() =>
      useScenarioRequiredInputs([productWithDefault], ["dscr"], null),
    );
    expect(result.current.inputs["dscr"]?.proposed_term_months).toBe(360);
  });

  it("existingContext values take priority over YAML defaults", () => {
    const fieldWithDefault = makeField("proposed_term_months", { default: 360 });
    const productWithDefault = makeProduct("dscr", [fieldWithDefault]);
    const existingContext: RefinementContext = {
      dscr: { inputs: { proposed_term_months: 180 } },
    };
    const { result } = renderHook(() =>
      useScenarioRequiredInputs([productWithDefault], ["dscr"], existingContext),
    );
    expect(result.current.inputs["dscr"]?.proposed_term_months).toBe(180);
  });
});

// ─── Validation + context tests ───────────────────────────────────────────────

describe("useScenarioRequiredInputs — validation", () => {
  it("isValid=false when required fields are empty", () => {
    const { result } = renderHook(() =>
      useScenarioRequiredInputs([dscrProduct], ["dscr"], null),
    );
    expect(result.current.isValid).toBe(false);
  });

  it("isValid=true after all required fields are filled via setInputs", () => {
    const { result } = renderHook(() =>
      useScenarioRequiredInputs([dscrProduct], ["dscr"], null),
    );
    act(() => {
      result.current.setInputs("dscr", {
        proposed_loan_amount: 500000,
        proposed_annual_rate: 0.07,
        proposed_term_months: 360,
      });
    });
    expect(result.current.isValid).toBe(true);
  });

  it("context is non-null when inputs are present", () => {
    const existingContext: RefinementContext = {
      dscr: {
        inputs: {
          proposed_loan_amount: 500000,
          proposed_annual_rate: 0.07,
          proposed_term_months: 360,
        },
      },
    };
    const { result } = renderHook(() =>
      useScenarioRequiredInputs([dscrProduct], ["dscr"], existingContext),
    );
    expect(result.current.context).not.toBeNull();
    expect(result.current.context?.dscr?.inputs?.proposed_loan_amount).toBe(500000);
  });

  it("context is null when no inputs are set", () => {
    const { result } = renderHook(() =>
      useScenarioRequiredInputs([dscrProduct], ["dscr"], null),
    );
    // No inputs seeded (no defaults, no existingContext)
    expect(result.current.context).toBeNull();
  });
});
