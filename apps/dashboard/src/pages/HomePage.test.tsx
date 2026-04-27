import { render, screen } from "@testing-library/react";
import { type Mock, describe, expect, it, vi } from "vitest";
import { useAuth } from "../hooks/useAuth";
import { HomePage } from "./HomePage";

vi.mock("../hooks/useAuth");
const mockUseAuth = useAuth as Mock;

describe("HomePage", () => {
	it("shows user email and sign out when user is present", () => {
		mockUseAuth.mockReturnValue({
			user: { email: "lo@example.com" },
			loading: false,
			signOut: vi.fn(),
		});
		render(<HomePage />);
		expect(screen.getByText("lo@example.com")).toBeDefined();
		expect(screen.getByRole("button", { name: /sign out/i })).toBeDefined();
	});
});
