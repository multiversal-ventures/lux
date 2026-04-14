import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useAuth } from "./useAuth";

vi.mock("firebase/auth", () => ({
	getAuth: vi.fn(() => ({})),
	onAuthStateChanged: vi.fn(),
	signOut: vi.fn(),
}));

import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";

const mockOnAuthStateChanged = onAuthStateChanged as Mock;
const mockFirebaseSignOut = firebaseSignOut as Mock;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("useAuth", () => {
	it("starts in loading state with no user", () => {
		mockOnAuthStateChanged.mockReturnValue(() => {});
		const { result } = renderHook(() => useAuth());
		expect(result.current.loading).toBe(true);
		expect(result.current.user).toBeNull();
	});

	it("resolves to user when Firebase returns an authenticated user", async () => {
		const fakeUser = { uid: "user-1", email: "test@example.com" };
		mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
			callback(fakeUser);
			return () => {};
		});

		const { result } = renderHook(() => useAuth());
		expect(result.current.loading).toBe(false);
		expect(result.current.user).toEqual(fakeUser);
	});

	it("resolves to null user when not authenticated", async () => {
		mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
			callback(null);
			return () => {};
		});

		const { result } = renderHook(() => useAuth());
		expect(result.current.loading).toBe(false);
		expect(result.current.user).toBeNull();
	});

	it("unsubscribes from auth changes on unmount", () => {
		const unsubscribe = vi.fn();
		mockOnAuthStateChanged.mockReturnValue(unsubscribe);

		const { unmount } = renderHook(() => useAuth());
		unmount();
		expect(unsubscribe).toHaveBeenCalledOnce();
	});

	it("calls Firebase signOut when signOut is invoked", async () => {
		mockOnAuthStateChanged.mockReturnValue(() => {});
		mockFirebaseSignOut.mockResolvedValue(undefined);

		const { result } = renderHook(() => useAuth());
		await act(() => result.current.signOut());
		expect(mockFirebaseSignOut).toHaveBeenCalledOnce();
	});

	it("swallows Firebase signOut errors without rethrowing", async () => {
		mockOnAuthStateChanged.mockReturnValue(() => {});
		mockFirebaseSignOut.mockRejectedValue(new Error("network error"));

		const { result } = renderHook(() => useAuth());
		// Should not throw
		await expect(act(() => result.current.signOut())).resolves.toBeUndefined();
	});
});
