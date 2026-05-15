import { describe, it, expect } from "vitest";
import { normalizeQualifyResult, parseStringArray } from "./normalize.js";

describe("normalizeQualifyResult", () => {
	it("prefers product === 'custom' even when other products have total_monthly > 0", () => {
		const event = {
			products: [
				{ product: "fannie_mae", specs_run: 3, total_monthly: 7538 },
				{ product: "custom", specs_run: 1, total_monthly: 2075 },
				{ product: "fha", specs_run: 2, total_monthly: 5200 },
			],
		};
		const { primary, all } = normalizeQualifyResult(event);
		expect(primary?.product).toBe("custom");
		expect(primary?.total_monthly).toBe(2075);
		expect(all).toHaveLength(3);
	});

	it("falls back to highest-monthly product when custom is absent", () => {
		const event = {
			products: [
				{ product: "fannie_mae", specs_run: 3, total_monthly: 0 },
				{ product: "fha", specs_run: 2, total_monthly: 5200 },
			],
		};
		const { primary } = normalizeQualifyResult(event);
		expect(primary?.product).toBe("fha");
	});

	it("returns products[0] when no product has positive total_monthly", () => {
		const event = {
			products: [
				{ product: "fannie_mae", specs_run: 3, total_monthly: 0 },
				{ product: "fha", specs_run: 2, total_monthly: 0 },
			],
		};
		const { primary } = normalizeQualifyResult(event);
		expect(primary?.product).toBe("fannie_mae");
	});

	it("returns null primary when products is missing", () => {
		const { primary, all } = normalizeQualifyResult({});
		expect(primary).toBeNull();
		expect(all).toEqual([]);
	});

	it("returns null primary when products is empty", () => {
		const { primary, all } = normalizeQualifyResult({ products: [] });
		expect(primary).toBeNull();
		expect(all).toEqual([]);
	});

	it("handles custom product with zero total_monthly (still selected)", () => {
		const event = {
			products: [
				{ product: "custom", specs_run: 1, total_monthly: 0 },
				{ product: "fannie_mae", specs_run: 3, total_monthly: 7538 },
			],
		};
		const { primary } = normalizeQualifyResult(event);
		expect(primary?.product).toBe("custom");
	});

	it("tolerates null eventData", () => {
		const { primary, all } = normalizeQualifyResult(null);
		expect(primary).toBeNull();
		expect(all).toEqual([]);
	});
});

describe("parseStringArray", () => {
	it("unwraps a Python-list string wrapped in a single-element array", () => {
		const input = ["['fannie_mae', 'freddie_mac', 'fha', 'va', 'usda', 'non_qm']"];
		expect(parseStringArray(input)).toEqual([
			"fannie_mae",
			"freddie_mac",
			"fha",
			"va",
			"usda",
			"non_qm",
		]);
	});

	it("returns a normal string[] unchanged", () => {
		const input = ["fannie_mae", "fha"];
		expect(parseStringArray(input)).toEqual(["fannie_mae", "fha"]);
	});

	it("returns [] for null", () => {
		expect(parseStringArray(null)).toEqual([]);
	});

	it("returns [] for undefined", () => {
		expect(parseStringArray(undefined)).toEqual([]);
	});

	it("returns empty array when input is empty", () => {
		expect(parseStringArray([])).toEqual([]);
	});

	it("handles a single-element array that is not a list string", () => {
		expect(parseStringArray(["fannie_mae"])).toEqual(["fannie_mae"]);
	});
});
