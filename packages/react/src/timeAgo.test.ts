import { describe, expect, it } from "vitest";

import { timeAgo } from "./timeAgo.js";

describe("timeAgo", () => {
	const now = new Date("2026-03-10T12:00:00Z");
	const ago = (sec: number) => new Date(now.getTime() - sec * 1000).toISOString();

	it("returns 'just now' under a minute", () => {
		expect(timeAgo(ago(0), now)).toBe("just now");
		expect(timeAgo(ago(59), now)).toBe("just now");
	});

	it("returns minutes under an hour", () => {
		expect(timeAgo(ago(60), now)).toBe("1m ago");
		expect(timeAgo(ago(59 * 60), now)).toBe("59m ago");
	});

	it("returns hours under a day", () => {
		expect(timeAgo(ago(60 * 60), now)).toBe("1h ago");
		expect(timeAgo(ago(23 * 60 * 60), now)).toBe("23h ago");
	});

	it("returns 'yesterday' under two days", () => {
		expect(timeAgo(ago(25 * 60 * 60), now)).toBe("yesterday");
	});

	it("returns a short date for older messages", () => {
		// 5 days ago → Mar 5
		expect(timeAgo(ago(5 * 24 * 60 * 60), now)).toBe("Mar 5");
	});

	it("returns '' for an unparseable input", () => {
		expect(timeAgo("not-a-date", now)).toBe("");
	});

	it("treats clock-skewed future timestamps as 'just now'", () => {
		expect(timeAgo(new Date(now.getTime() + 5000).toISOString(), now)).toBe("just now");
	});
});
