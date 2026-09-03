import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `BorrowerLinksModal` — the surface Task 1(b) exists to build.
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

const { BorrowerLinksModal } = await import("./BorrowerLinksModal");

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function renderModal(props: Partial<{ onClose: () => void; onNewLink: () => void }> = {}) {
	return render(<BorrowerLinksModal onClose={props.onClose ?? (() => {})} {...props} />, {
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

describe("BorrowerLinksModal", () => {
	it("renders the name the operator typed, which nothing did before", async () => {
		listPosPortals.mockResolvedValue([PORTAL, SECOND_PORTAL]);
		renderModal();

		// The actual strings, not a count: two links with different names must be
		// distinguishable, which is the entire reason `label` exists.
		expect(await screen.findByText("DSCR — my website")).toBeInTheDocument();
		expect(screen.getByText("DSCR — Facebook ad")).toBeInTheDocument();
	});

	it("shows the URL, slug, product and active state per link", async () => {
		renderModal();
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
		renderModal();

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
		renderModal();

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
		renderModal();

		expect(await screen.findByText("Active")).toBeInTheDocument();
		expect(screen.queryByText("Expired")).toBeNull();
	});

	it("Disable soft-disables through the client and the row updates", async () => {
		const user = userEvent.setup();
		renderModal();
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
		renderModal();
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
		renderModal();
		await expandFirstLink(user);

		expect(screen.getAllByText("maria@example.com").length).toBeGreaterThan(0);
		// `cases.name` is null for these rows; "Untitled Case" would name every
		// applicant on this surface identically.
		expect(screen.queryByText(/untitled/i)).toBeNull();
		expect(screen.getByText("Code not entered yet")).toBeInTheDocument();
	});

	it("resend mails the code and never shows it, but does show the address", async () => {
		const user = userEvent.setup();
		renderModal();
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
		renderModal();
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
		renderModal();
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
		renderModal();
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
		renderModal();
		await screen.findByText(PORTAL.label);
		await user.click(screen.getByRole("button", { name: /show applications/i }));

		expect(
			await screen.findByText(/nobody has started an application from this link yet/i),
		).toBeInTheDocument();
	});

	it("renders an empty state rather than an empty box", async () => {
		listPosPortals.mockResolvedValue([]);
		renderModal();
		expect(
			await screen.findByText(/you have not published any borrower links yet/i),
		).toBeInTheDocument();
	});

	/**
	 * The layout contract of the native `<dialog>` — asserted as classes, which
	 * is normally a smell, except that the regression it guards WAS a class
	 * string.
	 *
	 * When this modal moved from a `fixed inset-0 flex items-start
	 * justify-center` backdrop div to `showModal()`, the wrapper's classes came
	 * with it. A `showModal()`ed dialog is not a wrapper AROUND a card, it IS the
	 * card: the UA centres it with `margin: auto` against `inset: 0`, so `m-0`
	 * over-constrains it into a tall box pinned to the left edge, `max-w-none`
	 * lets it fill the viewport, and `bg-black/50` tints the card instead of
	 * dimming the page. Every test in this file stayed green throughout, because
	 * happy-dom computes no layout — the class string is the only part of this an
	 * in-process test can hold. (The geometry itself was checked in Chrome.)
	 */
	it("is a centred, bounded box dimmed by ::backdrop, not a full-viewport wrapper", async () => {
		renderModal();
		await screen.findByText(PORTAL.label);
		const dialog = screen.getByRole("dialog");
		const classes = dialog.className.split(/\s+/);

		// Tailwind preflight resets `margin: 0` on `*`, so the UA's centring has
		// to be put back explicitly or the box pins to the corner.
		expect(classes).toContain("m-auto");
		// Bounded on both axes, so it is sized to its content, not the viewport.
		expect(classes).toContain("max-w-3xl");
		expect(classes).toContain("max-h-[85vh]");
		// The dim belongs to `::backdrop`, the only surface that paints behind a
		// top-layer element.
		expect(dialog.className).toMatch(/\bbackdrop:bg-/);
		// `p-0`, so that the whole dialog box is covered by its children: the
		// backdrop-click handler keys on `e.target === dialog`, and padding would
		// turn a click just inside the card's edge into a dismissal.
		expect(classes).toContain("p-0");

		for (const wrapperOnly of [
			"fixed",
			"inset-0",
			"m-0",
			"max-w-none",
			"max-h-none",
			"bg-black/50",
		]) {
			expect(classes).not.toContain(wrapperOnly);
		}
	});

	it("scrolls the list inside the dialog rather than growing past the viewport", async () => {
		renderModal();
		const label = await screen.findByText(PORTAL.label);
		const dialog = screen.getByRole("dialog");
		// The dialog clips — it is the scroll region's frame, not the scroller.
		expect(dialog.className.split(/\s+/)).toContain("overflow-hidden");

		// …and the list, the only part of this surface that grows without bound,
		// is what scrolls.
		const scroller = label.closest(".overflow-y-auto");
		expect(scroller).not.toBeNull();
		expect(dialog.contains(scroller)).toBe(true);
		// `min-h-0` is what lets `overflow-y-auto` ever have an overflow: a flex
		// child's default `min-height: auto` refuses to shrink below its content,
		// so without it the dialog grows past `max-h-[85vh]` and nothing scrolls.
		const scrollerClasses = (scroller as HTMLElement).className.split(/\s+/);
		expect(scrollerClasses).toContain("min-h-0");
		expect(scrollerClasses).toContain("flex-1");
	});

	it("a click on the dialog box itself is the backdrop, and closes", async () => {
		// With the box shrunk to its content there is no exposed dialog surface
		// inside the card, so `e.target === dialog` now means exactly one thing:
		// the click landed on `::backdrop`. Chrome reports the `<dialog>` as the
		// target for such a click — verified there by dispatching a real mouse
		// event at a point outside `getBoundingClientRect()` — and this is the
		// in-process half: the handler is wired, and a click on a descendant does
		// NOT dismiss.
		const onClose = vi.fn();
		const user = userEvent.setup();
		renderModal({ onClose });
		await screen.findByText(PORTAL.label);

		await user.click(screen.getByRole("heading", { name: "Borrower links" }));
		expect(onClose).not.toHaveBeenCalled();

		await user.click(screen.getByRole("dialog"));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("the New link button appears only when the host wires it", async () => {
		const onNewLink = vi.fn();
		const { unmount } = renderModal({ onNewLink });
		const user = userEvent.setup();
		await user.click(await screen.findByRole("button", { name: "New link" }));
		expect(onNewLink).toHaveBeenCalled();
		unmount();

		renderModal();
		await screen.findByText(PORTAL.label);
		expect(screen.queryByRole("button", { name: "New link" })).toBeNull();
	});
});
