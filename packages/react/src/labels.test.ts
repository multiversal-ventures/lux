import { describe, expect, it } from "vitest";

import { eventLabel, partyTypeLabel, roleLabel, statusLabel } from "./labels.js";

describe("labels", () => {
	it("maps known roles to human text", () => {
		expect(roleLabel("borrower")).toBe("Borrower");
		expect(roleLabel("co_borrower")).toBe("Co-borrower");
		expect(roleLabel("owner")).toBe("Property owner");
	});

	it("never shows raw snake_case for unknown values", () => {
		expect(roleLabel("managing_member")).toBe("Managing Member");
		expect(statusLabel("in_review")).toBe("In Review");
	});

	it("maps party types, statuses, and events", () => {
		expect(partyTypeLabel("entity")).toBe("Business");
		expect(statusLabel("open")).toBe("Awaiting reply");
		expect(eventLabel("portal.borrower.replied")).toBe("Replied");
		expect(eventLabel("identity.borrower.verified")).toBe("Verified identity");
	});

	it("handles empty/nullish gracefully", () => {
		expect(roleLabel(null)).toBe("Party");
		expect(statusLabel("")).toBe("");
		expect(eventLabel(undefined)).toBe("");
	});
});
