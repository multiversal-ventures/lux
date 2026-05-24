/**
 * Pure unit tests for the product-metadata helpers — display label
 * resolution and the "do you have the required docs?" pre-flight gate.
 * The hooks that surface ``TenantProduct`` are React Query wrappers; the
 * helpers themselves are pure so we test them directly.
 */

import { describe, expect, it } from "vitest";

import {
  getProductDisplayLabel,
  validateRequiredDocuments,
  getMissingDocsErrorMessage,
} from "./productMetadata.js";
import type { TenantProduct } from "./useTenantProducts.js";

function makeProduct(overrides: Partial<TenantProduct> & { product_id: string }): TenantProduct {
  return {
    product_id: overrides.product_id,
    display_name: overrides.display_name ?? overrides.product_id,
    display_label:
      overrides.display_label ?? overrides.display_name ?? overrides.product_id,
    agency: overrides.agency ?? "FNMA",
    agency_path: overrides.agency_path ?? "fnma_multiple_entities",
    description: overrides.description ?? null,
    spec_filter: overrides.spec_filter ?? [],
    income_document_types: overrides.income_document_types ?? [],
    credit_document_types: overrides.credit_document_types ?? [],
    required_documents: overrides.required_documents ?? [],
    default_calculation_track: overrides.default_calculation_track ?? null,
    config: overrides.config ?? {},
    enabled: overrides.enabled ?? true,
    is_default: overrides.is_default ?? false,
    sort_order: overrides.sort_order ?? 0,
    groups: overrides.groups ?? [],
    initial_required_inputs: overrides.initial_required_inputs ?? [],
  };
}

describe("getProductDisplayLabel", () => {
  it("prefers the curated display_label", () => {
    const fnma = makeProduct({
      product_id: "fannie_mae",
      display_name: "Fannie Mae (Conventional)",
      display_label: "FNMA (Fannie Mae)",
    });
    expect(getProductDisplayLabel(fnma)).toBe("FNMA (Fannie Mae)");
  });

  it("falls back to display_name when display_label is empty", () => {
    // Backend never returns this in practice (the route resolves with a
    // display_name fallback), but the helper stays defensive so a stale
    // OpenAPI snapshot or a hand-built row in tests still renders sensibly.
    const partial = makeProduct({
      product_id: "wonky",
      display_name: "Wonky Product",
      display_label: "",
    });
    expect(getProductDisplayLabel(partial)).toBe("Wonky Product");
  });

  it("falls back to product_id when neither label is present", () => {
    const bare = makeProduct({
      product_id: "totally_unknown",
      display_name: "",
      display_label: "",
    });
    expect(getProductDisplayLabel(bare)).toBe("totally_unknown");
  });
});

describe("validateRequiredDocuments", () => {
  const products: TenantProduct[] = [
    makeProduct({
      product_id: "fannie_mae",
      display_name: "Fannie Mae (Conventional)",
      display_label: "FNMA (Fannie Mae)",
      required_documents: ["W2", "IRS1040"],
    }),
    makeProduct({
      product_id: "non_qm_bank_statement",
      display_name: "Non-QM Bank Statement",
      display_label: "Non-QM Bank Statement",
      agency_path: "non_qm_multiple_entities",
      required_documents: ["UnifiedBankStatement", "BankStatement"],
    }),
    makeProduct({
      product_id: "dscr",
      display_name: "DSCR (Investment Property)",
      display_label: "DSCR (Investment Property)",
      agency_path: "dscr_multiple_entities",
      required_documents: [
        "LeaseAgreement",
        "AppraisalReport",
        "PropertyTaxBill",
        "InsuranceDeclaration",
      ],
    }),
  ];

  it("passes when every selected product has at least one matching doc", () => {
    const result = validateRequiredDocuments(
      products,
      ["fannie_mae"],
      [{ documentType: "W2" }, { documentType: "PayStub" }],
    );
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("flags products that have zero matching docs", () => {
    const result = validateRequiredDocuments(
      products,
      ["fannie_mae", "non_qm_bank_statement"],
      [{ documentType: "W2" }],
    );
    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0].productId).toBe("non_qm_bank_statement");
    expect(result.missing[0].displayLabel).toBe("Non-QM Bank Statement");
    expect(result.missing[0].requiredDocuments).toEqual([
      "UnifiedBankStatement",
      "BankStatement",
    ]);
  });

  it("skips products with empty required_documents (any-of trivially holds)", () => {
    const productsWithEmpty: TenantProduct[] = [
      makeProduct({ product_id: "non_qm", required_documents: [] }),
    ];
    const result = validateRequiredDocuments(productsWithEmpty, ["non_qm"], []);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("ignores selected ids that aren't in the catalog (defensive)", () => {
    const result = validateRequiredDocuments(
      products,
      ["unknown_legacy_id"],
      [],
    );
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("returns the catalog product order, not the selection order", () => {
    // Stable output keeps the missing-docs banner UI deterministic across
    // re-selections — useful when multiple products fail at once.
    const result = validateRequiredDocuments(
      products,
      ["dscr", "fannie_mae"],
      [],
    );
    expect(result.valid).toBe(false);
    expect(result.missing.map((m) => m.productId)).toEqual([
      "fannie_mae",
      "dscr",
    ]);
  });
});

describe("getMissingDocsErrorMessage", () => {
  it("returns empty string for an empty missing list", () => {
    expect(getMissingDocsErrorMessage([])).toBe("");
  });

  it("composes the message from displayLabel + requiredDocuments — no hardcoded copy per product family", () => {
    const message = getMissingDocsErrorMessage([
      {
        productId: "non_qm_bank_statement",
        displayLabel: "Non-QM Bank Statement",
        requiredDocuments: ["UnifiedBankStatement", "BankStatement"],
      },
    ]);
    expect(message).toContain("Non-QM Bank Statement");
    expect(message).toContain("UnifiedBankStatement");
    expect(message).toContain("BankStatement");
    // Pin: no legacy "Bank Statement income requires bank statement…" copy.
    expect(message).not.toContain("Bank Statement income requires");
    expect(message).not.toContain("Qualified Mortgage products");
  });

  it("lists each missing product on its own line so multi-product cases stay readable", () => {
    const message = getMissingDocsErrorMessage([
      {
        productId: "fannie_mae",
        displayLabel: "FNMA (Fannie Mae)",
        requiredDocuments: ["W2", "IRS1040"],
      },
      {
        productId: "irs_1099_income",
        displayLabel: "1099 Income",
        requiredDocuments: ["IRS1099NEC", "IRS1099MISC"],
      },
    ]);
    const lines = message.split("\n");
    expect(lines.some((l) => l.startsWith("• FNMA (Fannie Mae)"))).toBe(true);
    expect(lines.some((l) => l.startsWith("• 1099 Income"))).toBe(true);
  });
});
