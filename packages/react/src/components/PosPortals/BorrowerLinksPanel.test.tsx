import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `BorrowerLinksPanel` — the surface Task 1(b) exists to build.
 *
 * Every assertion here is about OBSERVABLE DOM, not about a spy having been
 * called, because the defect this fixes was precisely "the value is fetched and
 * nothing renders it": `pos_portals.label` had a client method, a hook and a
 * returned array, and no reader. A test that asserted `listPosPortals` was
 * called would have been green throughout that entire bug.
 *
 * The negative assertions each carry their positive control in the same test:
 *
 * * "no per-link fetch on open" is paired with the SAME spy firing on expand;
 * * "the code is not on screen" is paired with the borrower's email being on
 *   screen, so it cannot pass because nothing rendered;
 * * the two resend failures assert two DIFFERENT sentences, so a component that
 *   collapsed them into one message would fail.
 */

class APIError extends Error {
	status: number;
	constructor(message: string, status: number) {
		super(message);
		this.name = "APIError";
		this.status = status;
	}
}

const PORTAL = {
	pos_portal_id: "pp-1",
	product_id: "dscr",
	slug: "abc123def456",
	label: "DSCR — my website",
	url: "/apply/abc123def456",
	active: true,
	expires_at: null,
	created_at: "2026-08-25T00:00:00Z",
};

const SECOND_PORTAL = {
	...PORTAL,
	pos_portal_id: "pp-2",
	slug: "zzz987yyy654",
	label: "DSCR — Facebook ad",
	url: "/apply/zzz987yyy654",
};

/** An applicant who typed an email into a public form and stopped: no case
 * name, no display name, no property. The email is all there is. */
const UNVERIFIED_CASE = {
	case_id: "case-1",
	name: null,
	state: "awaiting_verification",
	created_at: "2026-08-26T00:00:00Z",
	parties: [
		{ party_id: "party-1", email: "maria@example.com", display_name: null, role: "borrower" },
	],
};

const listPosPortals = vi.fn(async () => [PORTAL]);
const createPosPortal = vi.fn(async () => PORTAL);
const deactivatePosPortal = vi.fn(async () => ({ ...PORTAL, active: false }));
const listPosPortalCases = vi.fn(async () => [UNVERIFIED_CASE]);
const resendAccessCode = vi.fn(async () => ({
	ok: true,
	detail: "Access code re-sent to the address on file.",
}));

vi.mock("@multiversal-ventures/lux-core", () => ({
	APIError,
	getDefaultClient: () => ({
		listPosPortals,
		createPosPortal,
		deactivatePosPortal,
		listPosPortalCases,
		resendAccessCode,
	}),
}));

const { BorrowerLinksPanel } = await import("./BorrowerLinksPanel");

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function renderPanel() {
	return render(<BorrowerLinksPanel />, {
		wrapper,
	});
}

/** Expand the one link on screen and wait for its applications. */
async function expandFirstLink(user: ReturnType<typeof userEvent.setup>) {
	await screen.findByText(PORTAL.label);
	await user.click(screen.getByRole("button", { name: /show applications/i }));
	// `findAllBy`, not `findBy`: the address renders twice on an unverified row
	// — once as the application's heading (there is no case name to use) and once
	// beside its Resend button. That duplication is the design, not an accident.
	return screen.findAllByText("maria@example.com");
}

beforeEach(() => {
	queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	listPosPortals.mockReset();
	listPosPortals.mockResolvedValue([PORTAL]);
	createPosPortal.mockReset();
	createPosPortal.mockResolvedValue(PORTAL);
	deactivatePosPortal.mockReset();
	deactivatePosPortal.mockResolvedValue({ ...PORTAL, active: false });
	listPosPortalCases.mockReset();
	listPosPortalCases.mockResolvedValue([UNVERIFIED_CASE]);
	resendAccessCode.mockReset();
	resendAccessCode.mockResolvedValue({
		ok: true,
		detail: "Access code re-sent to the address on file.",
	});
});

describe("BorrowerLinksPanel", () => {
	it("renders the name the operator typed, which nothing did before", async () => {
		listPosPortals.mockResolvedValue([PORTAL, SECOND_PORTAL]);
		renderPanel();

		// The actual strings, not a count: two links with different names must be
		// distinguishable, which is the entire reason `label` exists.
		expect(await screen.findByText("DSCR — my website")).toBeInTheDocument();
		expect(screen.getByText("DSCR — Facebook ad")).toBeInTheDocument();
	});

	it("shows the URL, slug, product and active state per link", async () => {
		renderPanel();
		await screen.findByText(PORTAL.label);

		const url = screen.getByLabelText(`Application link for ${PORTAL.label}`);
		expect(url).toHaveValue("/apply/abc123def456");
		expect(screen.getByText("abc123def456", { exact: false })).toBeInTheDocument();
		expect(screen.getByText("dscr")).toBeInTheDocument();
		expect(screen.getByText("Active")).toBeInTheDocument();
	});

	it("a disabled link reads Disabled and offers no Disable button", async () => {
		// Positive control for the test above: "Active" is not a constant.
		listPosPortals.mockResolvedValue([{ ...PORTAL, active: false }]);
		renderPanel();

		expect(await screen.findByText("Disabled")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Disable" })).toBeNull();
	});

	it("an expired link is badged Expired, not Active", async () => {
		// `active` alone is not the question the operator is asking: an expired
		// link is still `active: true` server-side and still refuses every
		// applicant (`pos_repo.is_usable`). Badging it Active would have them hand
		// out a dead URL. The two tests above are the positive controls — the same
		// query finds "Active" for a live link and "Disabled" for a disabled one.
		listPosPortals.mockResolvedValue([
			{ ...PORTAL, active: true, expires_at: "2020-01-01T00:00:00Z" },
		]);
		renderPanel();

		expect(await screen.findByText("Expired")).toBeInTheDocument();
		expect(screen.queryByText("Active")).toBeNull();
	});

	it("a future expiry is still Active", async () => {
		// The other half: `expires_at` being SET is not what makes a link dead —
		// only its being in the past is. Without this, "Expired" could be a badge
		// for any link that carries an expiry at all.
		listPosPortals.mockResolvedValue([
			{ ...PORTAL, active: true, expires_at: "2099-01-01T00:00:00Z" },
		]);
		renderPanel();

		expect(await screen.findByText("Active")).toBeInTheDocument();
		expect(screen.queryByText("Expired")).toBeNull();
	});

	it("Disable soft-disables through the client and the row updates", async () => {
		const user = userEvent.setup();
		renderPanel();
		await screen.findByText(PORTAL.label);

		listPosPortals.mockResolvedValue([{ ...PORTAL, active: false }]);
		await user.click(screen.getByRole("button", { name: "Disable" }));

		expect(deactivatePosPortal).toHaveBeenCalledWith("pp-1");
		// Observable consequence, not just the spy: the invalidation refetched and
		// the row now reads Disabled.
		expect(await screen.findByText("Disabled")).toBeInTheDocument();
	});

	it("does not fetch a link's applications until it is expanded", async () => {
		const user = userEvent.setup();
		renderPanel();
		await screen.findByText(PORTAL.label);

		// Negative half.
		expect(listPosPortalCases).not.toHaveBeenCalled();

		// Positive control through the SAME spy. Without it, the assertion above
		// would pass just as well if the mocked client were unreachable.
		await expandFirstLink(user);
		expect(listPosPortalCases).toHaveBeenCalledWith("pp-1");
	});

	it("an unverified applicant is identified by their email, not by a placeholder", async () => {
		const user = userEvent.setup();
		renderPanel();
		await expandFirstLink(user);

		expect(screen.getAllByText("maria@example.com").length).toBeGreaterThan(0);
		// `cases.name` is null for these rows; "Untitled Case" would name every
		// applicant on this surface identically.
		expect(screen.queryByText(/untitled/i)).toBeNull();
		expect(screen.getByText("Code not entered yet")).toBeInTheDocument();
	});

	it("resend mails the code and never shows it, but does show the address", async () => {
		const user = userEvent.setup();
		renderPanel();
		await expandFirstLink(user);

		await user.click(screen.getByRole("button", { name: /resend code/i }));

		expect(resendAccessCode).toHaveBeenCalledWith("case-1", "party-1");
		expect(await screen.findByRole("status")).toHaveTextContent(
			"Access code re-sent to the address on file.",
		);
		// The pair: the address IS on screen (so this cannot pass on an empty
		// render) and no five-digit code is.
		expect(screen.getAllByText("maria@example.com").length).toBeGreaterThan(0);
		expect(document.body.textContent).not.toMatch(/\b\d{5}\b/);
	});

	it("a 409 and a 502 produce different sentences and different affordances", async () => {
		const user = userEvent.setup();
		renderPanel();
		await expandFirstLink(user);

		// 409 — terminal for this action. The server's remedy is rendered and no
		// retry is offered, because retrying an expired link cannot work.
		resendAccessCode.mockRejectedValueOnce(
			new APIError("This link has expired. Send them a new link.", 409),
		);
		await user.click(screen.getByRole("button", { name: /resend code/i }));
		const refused = await screen.findByRole("alert");
		expect(refused).toHaveTextContent("This link has expired. Send them a new link.");
		expect(within(refused).queryByRole("button", { name: /try again/i })).toBeNull();

		// 502 — a different sentence AND a retry affordance. If the component
		// collapsed statuses into one message, this assertion fails on the text.
		resendAccessCode.mockRejectedValueOnce(new APIError("Email delivery failed. Try again.", 502));
		await user.click(screen.getByRole("button", { name: /resend code/i }));
		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("Email delivery failed. Try again."),
		);
		const undelivered = screen.getByRole("alert");
		expect(undelivered).not.toHaveTextContent("This link has expired");
		expect(within(undelivered).getByRole("button", { name: /try again/i })).toBeInTheDocument();
	});

	it("a 429 says to wait rather than that nothing happened", async () => {
		const user = userEvent.setup();
		renderPanel();
		await expandFirstLink(user);

		resendAccessCode.mockRejectedValueOnce(
			new APIError("This borrower's inbox has had its limit of access-code emails.", 429),
		);
		await user.click(screen.getByRole("button", { name: /resend code/i }));

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("This borrower's inbox has had its limit");
		expect(alert).toHaveTextContent("Nothing was sent.");
	});

	it("a 404 says the application is gone and refreshes the list", async () => {
		const user = userEvent.setup();
		renderPanel();
		await expandFirstLink(user);

		listPosPortalCases.mockResolvedValue([]);
		resendAccessCode.mockRejectedValueOnce(new APIError("Case not found", 404));
		await user.click(screen.getByRole("button", { name: /resend code/i }));

		// The row it named really does leave the list — the refresh is observable,
		// not merely claimed in the copy.
		await waitFor(() =>
			expect(screen.getByText(/nobody has started an application/i)).toBeInTheDocument(),
		);
	});

	it("says so when a link has produced no applications", async () => {
		const user = userEvent.setup();
		listPosPortalCases.mockResolvedValue([]);
		renderPanel();
		await screen.findByText(PORTAL.label);
		await user.click(screen.getByRole("button", { name: /show applications/i }));

		expect(
			await screen.findByText(/nobody has started an application from this link yet/i),
		).toBeInTheDocument();
	});

	it("renders an empty state rather than an empty box", async () => {
		listPosPortals.mockResolvedValue([]);
		renderPanel();
		expect(
			await screen.findByText(/you have not published any borrower links yet/i),
		).toBeInTheDocument();
	});

	/**
	 * The panel is body only: no dialog box, no title, no close control. The host
	 * wraps it (gunnr in the same Radix `Dialog` every other modal in that app
	 * uses), so the classes asserted here are the scroll contract and nothing
	 * else. The dialog-geometry tests this file used to carry went with the
	 * `<dialog>` they described.
	 */
	it("scrolls its own content and takes the host's size class", async () => {
		render(<BorrowerLinksPanel className="max-h-[70vh]" />, { wrapper });
		await screen.findByText(PORTAL.label);
		const scroller = document.querySelector(".overflow-y-auto") as HTMLElement;
		expect(scroller).not.toBeNull();
		expect(scroller.className.split(/\s+/)).toContain("max-h-[70vh]");
	});

	it("renders no dialog of its own — that belongs to the host", async () => {
		renderPanel();
		await screen.findByText(PORTAL.label);
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
	});
});
