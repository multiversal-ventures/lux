import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { TenantProtectedRoute } from "./TenantProtectedRoute";

vi.mock("../hooks/useAuth");
import { useAuth } from "../hooks/useAuth";
const mockUseAuth = useAuth as Mock;

const FAKE_USER = {
	uid: "u1",
	email: "user@example.com",
	getIdToken: vi.fn().mockResolvedValue("fake-token"),
};

beforeEach(() => {
	vi.stubGlobal("fetch", vi.fn());
	vi.clearAllMocks();
	FAKE_USER.getIdToken.mockResolvedValue("fake-token");
});

afterEach(() => {
	vi.restoreAllMocks();
});

function renderRoute(children = <div>Protected content</div>) {
	return render(
		<MemoryRouter>
			<TenantProtectedRoute>{children}</TenantProtectedRoute>
		</MemoryRouter>,
	);
}

describe("TenantProtectedRoute", () => {
	it("shows spinner while auth is loading", () => {
		mockUseAuth.mockReturnValue({ user: null, loading: true, signOut: vi.fn() });
		const { container } = renderRoute();
		expect(container.querySelector(".spinner")).toBeDefined();
		expect(screen.queryByText("Protected content")).toBeNull();
	});

	it("redirects to /login when user is not authenticated", async () => {
		mockUseAuth.mockReturnValue({ user: null, loading: false, signOut: vi.fn() });
		const { container } = renderRoute();
		await waitFor(() => expect(container.textContent).toBe(""));
		expect(screen.queryByText("Protected content")).toBeNull();
	});

	it("renders children when user has a tenant", async () => {
		mockUseAuth.mockReturnValue({ user: FAKE_USER, loading: false, signOut: vi.fn() });
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: async () => ({ has_tenant: true }),
		} as Response);

		renderRoute();
		await waitFor(() => expect(screen.getByText("Protected content")).toBeDefined());
	});

	it("shows join form when user has no tenant", async () => {
		mockUseAuth.mockReturnValue({ user: FAKE_USER, loading: false, signOut: vi.fn() });
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: async () => ({ has_tenant: false }),
		} as Response);

		renderRoute();
		await waitFor(() => expect(screen.getByText("Join an Organization")).toBeDefined());
	});

	it("shows error message on network failure", async () => {
		mockUseAuth.mockReturnValue({ user: FAKE_USER, loading: false, signOut: vi.fn() });
		vi.mocked(fetch).mockRejectedValue(new Error("network down"));

		renderRoute();
		await waitFor(() =>
			expect(screen.getByText(/Network error.*Refresh to retry/)).toBeDefined(),
		);
	});

	it("shows error message on non-ok HTTP response", async () => {
		mockUseAuth.mockReturnValue({ user: FAKE_USER, loading: false, signOut: vi.fn() });
		vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);

		renderRoute();
		await waitFor(() =>
			expect(screen.getByText(/Could not verify organization status/)).toBeDefined(),
		);
	});

	it("shows join error when invite code is invalid", async () => {
		mockUseAuth.mockReturnValue({ user: FAKE_USER, loading: false, signOut: vi.fn() });
		vi.mocked(fetch)
			.mockResolvedValueOnce({ ok: true, json: async () => ({ has_tenant: false }) } as Response)
			.mockResolvedValueOnce({
				ok: false,
				json: async () => ({ detail: "Invalid invite code" }),
			} as Response);

		renderRoute();
		await waitFor(() => expect(screen.getByText("Join an Organization")).toBeDefined());

		const input = screen.getByPlaceholderText(/lux-A7K2/);
		await userEvent.type(input, "bad-code");
		await userEvent.click(screen.getByText("Join"));

		await waitFor(() => expect(screen.getByText("Invalid invite code")).toBeDefined());
	});
});
