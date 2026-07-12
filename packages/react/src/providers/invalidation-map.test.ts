import { describe, it, expect } from "vitest";
import { invalidationMap } from "./invalidation-map.js";

const has = (keys: unknown[][], target: unknown[]) =>
	keys.some((k) => JSON.stringify(k) === JSON.stringify(target));

describe("invalidationMap document live-update", () => {
	const cid = "case-123";
	// Hosts query documents under BOTH keys; the "Documents Found" panel uses
	// gunnr's ["case", caseId, "documents"]. Every doc-changing event must
	// invalidate it, or the count only updates on manual refresh.
	for (const ev of ["intake.file.processed", "classify.page.completed", "extraction.completed"]) {
		it(`${ev} invalidates both document keys`, () => {
			const keys = invalidationMap[ev](cid) as unknown[][];
			expect(has(keys, ["documents", cid])).toBe(true);
			expect(has(keys, ["case", cid, "documents"])).toBe(true);
		});
	}
});
