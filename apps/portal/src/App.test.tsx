import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("./pages/SessionPage", () => ({
	SessionPage: () => <div>session-mock</div>,
}));

vi.mock("./pages/ExpiredPage", () => ({
	ExpiredPage: () => <div>expired-mock</div>,
}));

describe("App", () => {
	it("renders the session page at /", async () => {
		window.history.pushState({}, "", "/");
		render(<App />);
		await waitFor(() => {
			expect(screen.getByText("session-mock")).toBeDefined();
		});
	});
});
