import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	COPIED_RESET_MS,
	CREATE_DEADLINE_MS,
	NewBorrowerExperiencePanel,
} from "./NewBorrowerExperiencePanel";

// Wire shape of `GET /api/products` — the caller passes these through.
const products = [
	{ product_id: "dscr", display_label: "DSCR" },
	{ product_id: "fnma", display_label: "Fannie Mae" },
];

const PORTAL = {
	slug: "abc123def456",
	url: "https://apply.example.com/apply/abc123def456",
};

// Cancel is the only dismissal route this panel owns. The backdrop, Escape and
// the dialog's own close control belong to the host's dialog now, and the panel
// reaches them through `onBusyChange` — asserted below rather than by driving a
// `<dialog>` this component no longer renders.

describe("NewBorrowerExperiencePanel", () => {
	// A test that installs fake timers and then times out never reaches its own
	// restore, and every later test in the file inherits a frozen clock. Belt on
	// top of that test's own `finally`.
	afterEach(() => {
		vi.useRealTimers();
	});

	// This test and "submits the selected product and label" below share the
	// same submit-button query on purpose: the next test is the positive control
	// that proves this click DOES reach `onCreate` when the label is filled in,
	// so `not.toHaveBeenCalled()` here means "the guard fired", not "the click
	// went nowhere".
	it("requires a label before it will submit", async () => {
		const create = vi.fn();
		render(<NewBorrowerExperiencePanel onClose={() => {}} products={products} onCreate={create} />);
		await userEvent.click(screen.getByRole("button", { name: /create link/i }));
		expect(create).not.toHaveBeenCalled();
		expect(screen.getByText(/name this link/i)).toBeInTheDocument();
	});

	it("submits the selected product and label", async () => {
		const create = vi.fn().mockResolvedValue(PORTAL);
		render(<NewBorrowerExperiencePanel onClose={() => {}} products={products} onCreate={create} />);
		await userEvent.type(screen.getByLabelText(/name/i), "DSCR — my website");
		// The SECOND product, not the default, so the assertion below can only
		// pass if the select is actually wired to the submitted payload.
		await userEvent.selectOptions(screen.getByLabelText(/product/i), "fnma");
		await userEvent.click(screen.getByRole("button", { name: /create link/i }));
		await waitFor(() =>
			expect(create).toHaveBeenCalledWith({
				product_id: "fnma",
				label: "DSCR — my website",
			}),
		);
	});

	it("defaults to the first product when the operator picks none", async () => {
		const create = vi.fn().mockResolvedValue(PORTAL);
		render(<NewBorrowerExperiencePanel onClose={() => {}} products={products} onCreate={create} />);
		await userEvent.type(screen.getByLabelText(/name/i), "  padded  ");
		await userEvent.click(screen.getByRole("button", { name: /create link/i }));
		// The label is submitted trimmed — the server rejects a blank one, and
		// stores the stripped value, so leading whitespace must not survive here.
		await waitFor(() =>
			expect(create).toHaveBeenCalledWith({ product_id: "dscr", label: "padded" }),
		);
	});

	it("shows the copyable URL once the link exists", async () => {
		const create = vi.fn().mockResolvedValue(PORTAL);
		render(<NewBorrowerExperiencePanel onClose={() => {}} products={products} onCreate={create} />);
		await userEvent.type(screen.getByLabelText(/name/i), "x");
		await userEvent.click(screen.getByRole("button", { name: /create link/i }));
		await waitFor(() => expect(screen.getByDisplayValue(PORTAL.url)).toBeInTheDocument());
		// The server composes the URL (it is site-relative when the deployment
		// has no public base URL), so the modal must display it, not rebuild it.
		expect(screen.getByLabelText(/application link/i)).toHaveValue(PORTAL.url);
	});

	it("surfaces a server error instead of closing silently", async () => {
		const onClose = vi.fn();
		const create = vi.fn().mockRejectedValue(new Error("Unknown or disabled product: x"));
		render(<NewBorrowerExperiencePanel onClose={onClose} products={products} onCreate={create} />);
		await userEvent.type(screen.getByLabelText(/name/i), "x");
		await userEvent.click(screen.getByRole("button", { name: /create link/i }));
		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/unknown/i));
		expect(onClose).not.toHaveBeenCalled();
		// Still on the form, so the operator can fix the input and retry.
		expect(screen.getByRole("button", { name: /create link/i })).toBeInTheDocument();
	});

	it("starts a fresh form on a fresh mount after a link was made", async () => {
		// The host mounts this panel only while its dialog is open, so "reopen" is
		// "mount again". Without that the previous link's URL would still be on
		// screen the next time the operator opens the dialog, reading as "you
		// already made this one".
		const create = vi.fn().mockResolvedValue(PORTAL);
		const props = { products, onCreate: create, onClose: () => {} };
		const { unmount } = render(<NewBorrowerExperiencePanel {...props} />);
		await userEvent.type(screen.getByLabelText(/name/i), "first link");
		await userEvent.click(screen.getByRole("button", { name: /create link/i }));
		await waitFor(() => expect(screen.getByDisplayValue(PORTAL.url)).toBeInTheDocument());
		unmount();

		render(<NewBorrowerExperiencePanel {...props} />);
		expect(screen.queryByDisplayValue(PORTAL.url)).toBeNull();
		expect(screen.getByLabelText(/name/i)).toHaveValue("");
	});

	// POSITIVE CONTROL for the in-flight test below. Asserting only "onClose was
	// not called while busy" would pass just as well against a Cancel button that
	// never worked at all, so the route is first proven to work.
	it("closes through Cancel when nothing is in flight", async () => {
		const onClose = vi.fn();
		render(<NewBorrowerExperiencePanel onClose={onClose} products={products} onCreate={vi.fn()} />);
		await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	/**
	 * The in-flight guard, in the two halves it now has.
	 *
	 * Cancel is refused here, in the panel. Every other dismissal route — the
	 * backdrop, Escape, the dialog's own close control — belongs to the host's
	 * dialog, and the only thing the panel can do about them is say when a create
	 * is in flight. So `onBusyChange` is not a convenience: it IS the guard on
	 * three of the four routes, and a host that drops it can strand a link.
	 */
	it("refuses Cancel and reports busy while the create is in flight, and releases both once it settles", async () => {
		// A deferred promise, not `mockResolvedValue`: `busy` is only observable
		// while `onCreate` is still pending.
		// Real timers, so `CREATE_DEADLINE_MS` is genuinely running underneath
		// this test: it stays green because the whole test finishes in
		// milliseconds, far inside that window.
		let release: (portal: typeof PORTAL) => void = () => {};
		const create = vi.fn(
			() =>
				new Promise<typeof PORTAL>((resolve) => {
					release = resolve;
				}),
		);
		const onClose = vi.fn();
		const onBusyChange = vi.fn();
		render(
			<NewBorrowerExperiencePanel
				onClose={onClose}
				onBusyChange={onBusyChange}
				products={products}
				onCreate={create}
			/>,
		);
		// Mount reports the resting state, so a host that only ever hears about
		// changes still starts from a known one.
		expect(onBusyChange).toHaveBeenLastCalledWith(false);

		await userEvent.type(screen.getByLabelText(/name/i), "in flight");
		await userEvent.click(screen.getByRole("button", { name: /create link/i }));
		await waitFor(() => expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled());

		// The host is told, so it can hold its dialog shut.
		expect(onBusyChange).toHaveBeenLastCalledWith(true);
		// Visibly refused, not silently: Cancel is disabled too, so the operator is
		// not clicking a live-looking control.
		expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
		await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
		// The POST may already have minted the portal; its URL is only ever shown
		// here, so closing now would strand a live link.
		expect(onClose).not.toHaveBeenCalled();

		release(PORTAL);
		await waitFor(() => expect(screen.getByDisplayValue(PORTAL.url)).toBeInTheDocument());
		// Both halves release together: the host is told, and the dismissal the
		// result view offers — Done, where Cancel stood — bites again.
		await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
		await userEvent.click(screen.getByRole("button", { name: /done/i }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	/**
	 * The panel is body only: no dialog box, no title, no close control. What is
	 * left to assert is the scroll contract and the absence of a second dialog —
	 * the geometry tests this file used to carry went with the `<dialog>` they
	 * described, to gunnr's `Dialog`, which owns it for every modal in that app.
	 */
	it("scrolls its own content and takes the host's size class", () => {
		render(
			<NewBorrowerExperiencePanel
				className="max-h-[70vh]"
				onClose={() => {}}
				products={products}
				onCreate={vi.fn()}
			/>,
		);
		const scroller = screen.getByLabelText(/name/i).closest(".overflow-y-auto") as HTMLElement;
		expect(scroller).not.toBeNull();
		expect(scroller.className.split(/\s+/)).toContain("max-h-[70vh]");
	});

	it("renders no dialog of its own — that belongs to the host", () => {
		render(
			<NewBorrowerExperiencePanel onClose={() => {}} products={products} onCreate={vi.fn()} />,
		);
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(screen.queryByRole("button", { name: /^close$/i })).toBeNull();
	});

	it("will not submit when there is no product to submit under", async () => {
		const create = vi.fn().mockResolvedValue(PORTAL);
		const { unmount } = render(
			<NewBorrowerExperiencePanel onClose={() => {}} products={[]} onCreate={create} />,
		);
		await userEvent.type(screen.getByLabelText(/name/i), "no product");
		expect(screen.getByRole("button", { name: /create link/i })).toBeDisabled();
		await userEvent.click(screen.getByRole("button", { name: /create link/i }));
		// Otherwise this POSTs `product_id: ""` and the operator reads the server's
		// "Unknown or disabled product:" with a blank tail.
		expect(create).not.toHaveBeenCalled();
		unmount();

		// Positive control: the same button, with a product list, is live.
		render(<NewBorrowerExperiencePanel onClose={() => {}} products={products} onCreate={create} />);
		await userEvent.type(screen.getByLabelText(/name/i), "has product");
		expect(screen.getByRole("button", { name: /create link/i })).toBeEnabled();
		await userEvent.click(screen.getByRole("button", { name: /create link/i }));
		await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
	});

	it("releases the guard when the create never settles", async () => {
		// Fake timers scoped to this one test, `shouldAdvanceTime` so the clock
		// still moves with real time: userEvent's own inter-event delays are
		// `setTimeout`s, and on a frozen clock `user.type` never resolves — a
		// plain `vi.useFakeTimers()` here hangs the test until vitest kills it at
		// 5s. `userEvent.setup()` rather than the static API the rest of this file
		// uses, for the same reason the copy test explains: the static API and a
		// non-default clock do not mix.
		vi.useFakeTimers({ shouldAdvanceTime: true });
		try {
			const user = userEvent.setup();
			const onClose = vi.fn();
			const onBusyChange = vi.fn();
			// The case the guard alone could not escape: a promise that never
			// settles, so `busy` is never cleared by the request. Without the
			// deadline the host would hold its dialog shut forever off the `true`
			// below, and the operator's only exit would be a page reload.
			const create = vi.fn(() => new Promise<never>(() => {}));
			render(
				<NewBorrowerExperiencePanel
					onClose={onClose}
					onBusyChange={onBusyChange}
					products={products}
					onCreate={create}
				/>,
			);
			await user.type(screen.getByLabelText(/name/i), "hung");
			await user.click(screen.getByRole("button", { name: /create link/i }));

			// Still refused while the create is in flight — the fix this bounds is
			// intact, not traded away.
			expect(onBusyChange).toHaveBeenLastCalledWith(true);
			expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
			await user.click(screen.getByRole("button", { name: /cancel/i }));
			expect(onClose).not.toHaveBeenCalled();

			// Half the window: still refused, so the release below is the deadline
			// firing and not merely "some time passed". Half rather than
			// `CREATE_DEADLINE_MS - 1` because `shouldAdvanceTime` lets real
			// elapsed milliseconds onto the same clock, and the interactions above
			// have already spent some of them.
			await act(async () => {
				await vi.advanceTimersByTimeAsync(CREATE_DEADLINE_MS / 2);
			});
			expect(onBusyChange).toHaveBeenLastCalledWith(true);
			expect(onClose).not.toHaveBeenCalled();

			await act(async () => {
				await vi.advanceTimersByTimeAsync(CREATE_DEADLINE_MS);
			});

			// The operator is told what happened rather than silently released:
			// the POST was abandoned, not cancelled, so a link may exist.
			expect(screen.getByRole("alert")).toHaveTextContent(/did not answer in time/i);
			// Both halves of the guard let go: the host is free to close its dialog
			// again, and Cancel bites.
			expect(onBusyChange).toHaveBeenLastCalledWith(false);
			expect(screen.getByRole("button", { name: /cancel/i })).toBeEnabled();
			await user.click(screen.getByRole("button", { name: /cancel/i }));
			expect(onClose).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	// The other end of the deadline: the timer outlives `submit()` while the
	// create is in flight, because `finally` does not run until the race settles.
	// Unmount is the one dismissal route the guard cannot refuse — and it is how
	// the host closes this panel — so it is the one that has to clear the timer.
	it("clears the deadline timer when the panel is unmounted mid-flight", () => {
		// Plain fake timers and `fireEvent`, not `shouldAdvanceTime` + `userEvent`
		// as the test above uses: this test COUNTS timers, and userEvent schedules
		// its own inter-event `setTimeout`s. With `fireEvent` the deadline is the
		// only timer in flight, so the counts below are exact rather than a floor.
		vi.useFakeTimers();
		try {
			const create = vi.fn(() => new Promise<never>(() => {}));
			const { unmount } = render(
				<NewBorrowerExperiencePanel onClose={() => {}} products={products} onCreate={create} />,
			);
			fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "hung" } });
			// Baseline, so "1" below is the deadline and not some ambient timer.
			expect(vi.getTimerCount()).toBe(0);

			fireEvent.click(screen.getByRole("button", { name: /create link/i }));
			expect(create).toHaveBeenCalledTimes(1);
			expect(vi.getTimerCount()).toBe(1);

			unmount();
			expect(vi.getTimerCount()).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});

	it("copies the server's URL verbatim, and stops saying Copied", async () => {
		const writeText = vi.fn(async () => {});
		Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
		const create = vi.fn().mockResolvedValue(PORTAL);
		render(<NewBorrowerExperiencePanel onClose={() => {}} products={products} onCreate={create} />);
		await userEvent.type(screen.getByLabelText(/name/i), "x");
		await userEvent.click(screen.getByRole("button", { name: /create link/i }));
		await waitFor(() => expect(screen.getByDisplayValue(PORTAL.url)).toBeInTheDocument());

		await userEvent.click(screen.getByRole("button", { name: /copy link/i }));
		// The server's URL, not one composed here.
		expect(writeText).toHaveBeenCalledWith(PORTAL.url);
		await waitFor(() =>
			expect(screen.getByRole("button", { name: /^copied$/i })).toBeInTheDocument(),
		);

		// Real timers on purpose: the timeout is scheduled by the click above, so
		// installing fake timers afterwards would not own it. The window is read
		// from the component rather than restated here.
		await waitFor(
			() => expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument(),
			{ timeout: COPIED_RESET_MS + 2500 },
		);
	}, 10000);
});
