import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, type Mock } from "vitest";
import { SessionPage } from "./SessionPage";

vi.mock("@multiversal-ventures/lux-react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@multiversal-ventures/lux-react")>();
	return { ...actual, usePortalSession: vi.fn() };
});
import { usePortalSession } from "@multiversal-ventures/lux-react";
import type { PortalClientError } from "@multiversal-ventures/lux-core";
const mockUsePortalSession = usePortalSession as Mock;

const SESSION_FIXTURE = {
	session_id: "sess-1",
	entity: { identity_id: "id-1", name: "Alice", role: "borrower" },
	case_id: "case-1",
	case_state: "active",
	checklist: [
		{ id: "item-1", status: "pending", title: "Upload W2", detail: "Provide your W2", action: "Upload", priority: "high", finding_code: "w2", display_hints: { component: "file_upload", accept: null, label: null } },
		{ id: "item-2", status: "verified", title: "Identity verified", detail: "ID confirmed", action: "", priority: "low", finding_code: "id", display_hints: { component: "status", accept: null, label: null } },
	],
	consent: { sms_opt_in: false, email_opt_in: false, doc_sharing: false, electronic_records: false, credit_pull: false },
	verification: { level: 0, verified: false },
	upload_config: { max_file_size_mb: 10, accepted_types: [".pdf"], endpoint: "/upload" },
};

function renderPage() {
	return render(
		<MemoryRouter>
			<SessionPage />
		</MemoryRouter>,
	);
}

describe("SessionPage", () => {
	it("shows spinner while loading", () => {
		mockUsePortalSession.mockReturnValue({ session: null, loading: true, error: null, submitIntent: vi.fn() });
		const { container } = renderPage();
		expect(container.querySelector(".spinner")).toBeDefined();
	});

	it("redirects to /expired when error code is 'expired'", () => {
		const error: PortalClientError = { code: "expired", message: "Expired" };
		mockUsePortalSession.mockReturnValue({ session: null, loading: false, error, submitIntent: vi.fn() });
		const { container } = renderPage();
		expect(container.textContent).toBe("");
	});

	it("redirects to /expired when error code is 'no_token'", () => {
		const error: PortalClientError = { code: "no_token", message: "No token" };
		mockUsePortalSession.mockReturnValue({ session: null, loading: false, error, submitIntent: vi.fn() });
		const { container } = renderPage();
		expect(container.textContent).toBe("");
	});

	it("shows error message for server errors", () => {
		const error: PortalClientError = { code: "server", message: "Server error 500" };
		mockUsePortalSession.mockReturnValue({ session: null, loading: false, error, submitIntent: vi.fn() });
		renderPage();
		expect(screen.getByText("Server error 500")).toBeDefined();
	});

	it("renders incomplete and verified checklist sections", () => {
		mockUsePortalSession.mockReturnValue({ session: SESSION_FIXTURE, loading: false, error: null, submitIntent: vi.fn() });
		renderPage();
		expect(screen.getByText("Upload W2")).toBeDefined();
		expect(screen.getByText("Identity verified")).toBeDefined();
		expect(screen.getByText(/Action needed/)).toBeDefined();
		expect(screen.getByText(/Completed/)).toBeDefined();
	});

	it("shows consent banner when doc_sharing is false", () => {
		mockUsePortalSession.mockReturnValue({ session: SESSION_FIXTURE, loading: false, error: null, submitIntent: vi.fn() });
		renderPage();
		expect(screen.getByText(/I agree/i)).toBeDefined();
	});

	it("calls submitIntent when grant permission is clicked", async () => {
		const submitIntent = vi.fn().mockResolvedValue(undefined);
		mockUsePortalSession.mockReturnValue({ session: SESSION_FIXTURE, loading: false, error: null, submitIntent });
		renderPage();

		await userEvent.click(screen.getByText(/I agree/i));
		await waitFor(() => expect(submitIntent).toHaveBeenCalledOnce());
	});

	it("shows empty state when checklist is empty", () => {
		const emptySession = { ...SESSION_FIXTURE, checklist: [] };
		mockUsePortalSession.mockReturnValue({ session: emptySession, loading: false, error: null, submitIntent: vi.fn() });
		renderPage();
		expect(screen.getByText(/all caught up/i)).toBeDefined();
	});
});
