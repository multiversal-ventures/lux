import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("firebase/app", () => ({}));
vi.mock("firebase/auth", () => ({
	getAuth: vi.fn(() => ({})),
	isSignInWithEmailLink: vi.fn(() => false),
	sendSignInLinkToEmail: vi.fn(),
	signInWithEmailLink: vi.fn(),
	onAuthStateChanged: vi.fn((_auth, next) => {
		next(null);
		return () => {};
	}),
}));

vi.mock("firebaseui", () => ({}));
vi.mock("./lib/firebase", () => ({ waitForAuth: async () => null }));

vi.mock("./hooks/useAuth", () => ({
	useAuth: () => ({ user: null, loading: false, signOut: vi.fn() }),
}));

describe("App", () => {
	it("renders login route for /", async () => {
		window.history.pushState({}, "", "/");
		render(<App />);
		await waitFor(() => {
			expect(screen.getByText(/Sign in to access loan officer tools/i)).toBeDefined();
		});
	});
});
