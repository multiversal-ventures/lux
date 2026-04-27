import type { User } from "firebase/auth";
import { describe, expect, it, vi } from "vitest";

const user = { uid: "u1", email: "a@b.c" } as User;

vi.mock("firebase/auth", () => ({
	getAuth: vi.fn(() => ({})),
	// Defer the first callback so the returned unsubscribe is assigned (matches typical Firebase behavior).
	onAuthStateChanged: vi.fn((_auth: unknown, next: (u: User | null) => void) => {
		queueMicrotask(() => {
			next(user);
		});
		return () => {};
	}),
}));

describe("waitForAuth", () => {
	it("resolves to the first auth state callback value", async () => {
		const { waitForAuth } = await import("./firebase");
		const result = await waitForAuth();
		expect(result).toEqual(user);
	});
});
