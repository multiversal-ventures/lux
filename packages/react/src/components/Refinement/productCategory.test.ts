import { describe, it, expect } from "vitest";
import { resolveProductCategory } from "./productCategory.js";

describe("resolveProductCategory", () => {
  it("returns 'qm' for qualified_mortgage", () => {
    expect(resolveProductCategory("qualified_mortgage", ["fannie_mae"])).toBe("qm");
  });

  it("returns 'dscr' for dscr approach", () => {
    expect(resolveProductCategory("dscr", [])).toBe("dscr");
  });

  it("returns '1099' when Non-QM + a 1099 product id is present", () => {
    expect(
      resolveProductCategory("non_qualified_mortgage", ["irs_1099_income"]),
    ).toBe("1099");
  });

  it("returns 'bank_statement' when Non-QM + bank-statement product id", () => {
    expect(
      resolveProductCategory("non_qualified_mortgage", ["non_qm_bank_statement"]),
    ).toBe("bank_statement");
  });

  it("prefers '1099' over 'bank_statement' when both are present (1099 wins)", () => {
    expect(
      resolveProductCategory("non_qualified_mortgage", ["irs_1099_income", "non_qm_bank_statement"]),
    ).toBe("1099");
  });

  it("defaults Non-QM with unknown products to '1099'", () => {
    expect(resolveProductCategory("non_qualified_mortgage", [])).toBe("1099");
  });

  it("falls back to 'qm' when approach is null/missing", () => {
    expect(resolveProductCategory(null, [])).toBe("qm");
    expect(resolveProductCategory(undefined, [])).toBe("qm");
  });

  it("is case-insensitive for both approach and product ids", () => {
    expect(
      resolveProductCategory("NON_QUALIFIED_MORTGAGE", ["NON_QM_BANK_STATEMENT"]),
    ).toBe("bank_statement");
  });
});
