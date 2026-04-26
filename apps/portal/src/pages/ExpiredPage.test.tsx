import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExpiredPage } from "./ExpiredPage";

describe("ExpiredPage", () => {
	it("explains that the link expired", () => {
		render(<ExpiredPage />);
		expect(screen.getByRole("heading", { name: /link expired/i })).toBeDefined();
		expect(screen.getByText(/contact your loan officer/i)).toBeDefined();
	});
});
