import { describe, it, expect } from "vitest";
import { normalizeQualifyResult } from "./normalize";

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
