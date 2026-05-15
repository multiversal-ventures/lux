import { describe, it, expect } from "vitest";
import { validateTaxYears } from "./TaxYearOverridePicker.js";

describe("validateTaxYears", () => {
  it("is valid when both years are unset", () => {
    expect(validateTaxYears(null, null)).toEqual({ valid: true, error: null });
  });

  it("is valid when only Y1 is set", () => {
    expect(validateTaxYears("2024", null)).toEqual({ valid: true, error: null });
  });

  it("rejects identical years", () => {
    expect(validateTaxYears("2024", "2024")).toEqual({
      valid: false,
      error: "Year 1 and Year 2 cannot be the same",
    });
  });

  it("rejects Y1 older than Y2", () => {
    expect(validateTaxYears("2022", "2024")).toEqual({
      valid: false,
      error: "Year 1 must be more recent than Year 2",
    });
  });

  it("accepts Y1 more recent than Y2", () => {
    expect(validateTaxYears("2024", "2023")).toEqual({ valid: true, error: null });
  });
});
