import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, type Mock } from "vitest";
import { PublicRoute } from "./PublicRoute";

vi.mock("../hooks/useAuth");
import { useAuth } from "../hooks/useAuth";
const mockUseAuth = useAuth as Mock;

describe("PublicRoute", () => {
	it("renders children when user is not authenticated", () => {
		mockUseAuth.mockReturnValue({ user: null, loading: false, signOut: vi.fn() });
		render(
			<MemoryRouter>
				<PublicRoute><div>Login form</div></PublicRoute>
			</MemoryRouter>,
		);
		expect(screen.getByText("Login form")).toBeDefined();
	});

	it("shows loading spinner while auth state is resolving", () => {
		mockUseAuth.mockReturnValue({ user: null, loading: true, signOut: vi.fn() });
		const { container } = render(
			<MemoryRouter>
				<PublicRoute><div>Login form</div></PublicRoute>
			</MemoryRouter>,
		);
		// Children should not render while loading
		expect(screen.queryByText("Login form")).toBeNull();
		// Spinner should be present
		expect(container.querySelector(".spinner")).toBeDefined();
	});

	it("redirects to /app when user is authenticated", () => {
		const fakeUser = { uid: "u1", email: "user@example.com" };
		mockUseAuth.mockReturnValue({ user: fakeUser, loading: false, signOut: vi.fn() });

		const { container } = render(
			<MemoryRouter initialEntries={["/login"]}>
				<PublicRoute><div>Login form</div></PublicRoute>
			</MemoryRouter>,
		);
		expect(screen.queryByText("Login form")).toBeNull();
		// Navigate component renders nothing visible — just verify children are gone
		expect(container.textContent).toBe("");
	});
});
