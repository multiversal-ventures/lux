/**
 * Pure unit tests for the selector helpers exported alongside
 * ``useTenantProducts``. The hook itself is just a React Query wrapper
 * that exercises the same selectors, so testing the selectors directly
 * keeps these fast and DB-free.
 */

import { describe, expect, it } from "vitest";

import {
  groupProductsByApproach,
  toApproachOptions,
  toProductOptions,
  type TenantProduct,
} from "./useTenantProducts.js";

function makeProduct(overrides: Partial<TenantProduct> & { product_id: string }): TenantProduct {
  return {
    product_id: overrides.product_id,
    display_name: overrides.display_name ?? overrides.product_id,
    agency: overrides.agency ?? "FNMA",
    agency_path: overrides.agency_path ?? "fnma_multiple_entities",
    description: overrides.description ?? null,
    spec_filter: overrides.spec_filter ?? [],
    income_document_types: overrides.income_document_types ?? [],
    credit_document_types: overrides.credit_document_types ?? [],
    default_calculation_track: overrides.default_calculation_track ?? null,
    config: overrides.config ?? {},
    enabled: overrides.enabled ?? true,
    is_default: overrides.is_default ?? false,
    sort_order: overrides.sort_order ?? 0,
    groups: overrides.groups ?? [],
    initial_required_inputs:
      overrides.initial_required_inputs ?? { groups: [], products: [] },
  };
}

describe("groupProductsByApproach", () => {
  it("classifies Non-QM by agency_path prefix", () => {
    const products: TenantProduct[] = [
      makeProduct({ product_id: "fannie_mae", agency_path: "fnma_multiple_entities" }),
      makeProduct({
        product_id: "non_qm_bank_statement",
        agency_path: "non_qm_multiple_entities",
      }),
      makeProduct({
        product_id: "irs_1099_income",
        agency_path: "non_qm_multiple_entities",
      }),
    ];
    const grouped = groupProductsByApproach(products);
    expect(grouped.qm.map((p) => p.product_id)).toEqual(["fannie_mae"]);
    expect(grouped.non_qm.map((p) => p.product_id)).toEqual([
      "non_qm_bank_statement",
      "irs_1099_income",
    ]);
  });

  it("handles missing agency_path as QM (defensive default)", () => {
    const grouped = groupProductsByApproach([
      makeProduct({ product_id: "wonky", agency_path: "" }),
    ]);
    expect(grouped.qm).toHaveLength(1);
    expect(grouped.non_qm).toHaveLength(0);
  });
});

describe("toApproachOptions", () => {
  it("emits one option per non-empty approach group", () => {
    const options = toApproachOptions([
      makeProduct({ product_id: "fannie_mae", display_name: "Fannie Mae" }),
      makeProduct({
        product_id: "non_qm_bank_statement",
        display_name: "Non-QM Bank Statement",
        agency_path: "non_qm_multiple_entities",
      }),
    ]);
    expect(options.map((o) => o.id)).toEqual([
      "qualified_mortgage",
      "non_qualified_mortgage",
    ]);
    expect(options[0].description).toContain("Fannie Mae");
    expect(options[1].description).toContain("Non-QM Bank Statement");
  });

  it("skips empty approaches", () => {
    const options = toApproachOptions([
      makeProduct({ product_id: "fannie_mae" }),
    ]);
    expect(options.map((o) => o.id)).toEqual(["qualified_mortgage"]);
  });

  it("returns empty for an empty catalog", () => {
    expect(toApproachOptions([])).toEqual([]);
  });
});

describe("toProductOptions", () => {
  it("maps the API shape to the chip-picker shape", () => {
    const opts = toProductOptions([
      makeProduct({ product_id: "fannie_mae", display_name: "Fannie Mae" }),
      makeProduct({
        product_id: "disabled_thing",
        display_name: "Disabled Thing",
        enabled: false,
      }),
    ]);
    expect(opts).toEqual([
      { id: "fannie_mae", label: "Fannie Mae", enabled: true },
      { id: "disabled_thing", label: "Disabled Thing", enabled: false },
    ]);
  });
});

describe("TenantProduct.initial_required_inputs", () => {
  /**
   * Pins the contract that the create-case modal can read the schema
   * straight off the picked row — no second round-trip. Mirrors what the
   * backend folds in via ``GET /api/products`` (DSCR carries 3 fields,
   * QM products an empty section).
   */
  it("passes through the schema attached to a product row", () => {
    const dscr = makeProduct({
      product_id: "dscr",
      display_name: "DSCR",
      agency_path: "dscr_multiple_entities",
      initial_required_inputs: {
        groups: [],
        products: [
          {
            product_id: "dscr",
            display_name: "DSCR",
            fields: [
              {
                name: "proposed_loan_amount",
                type: "currency",
                label: "Proposed Loan Amount",
                required: true,
                required_at_create: true,
                unit: "usd",
                minimum: 1,
                maximum: 100000000,
                spec_name: "dscr_ratio_calculation",
                options: [],
              },
            ],
          },
        ],
      },
    });
    expect(dscr.initial_required_inputs?.products[0]?.fields[0]?.name).toBe(
      "proposed_loan_amount",
    );
    expect(
      dscr.initial_required_inputs?.products[0]?.fields[0]?.required_at_create,
    ).toBe(true);
  });

  it("defaults to an empty section for products without create-time inputs", () => {
    const fnma = makeProduct({ product_id: "fannie_mae" });
    expect(fnma.initial_required_inputs?.groups).toEqual([]);
    expect(fnma.initial_required_inputs?.products).toEqual([]);
  });
});
