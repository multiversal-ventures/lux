import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	COPIED_RESET_MS,
	CREATE_DEADLINE_MS,
	NewBorrowerExperienceModal,
} from "./NewBorrowerExperienceModal";

// Wire shape of `GET /api/products` — the caller passes these through.
const products = [
	{ product_id: "dscr", display_label: "DSCR" },
	{ product_id: "fnma", display_label: "Fannie Mae" },
];

const PORTAL = {
	slug: "abc123def456",
	url: "https://apply.example.com/apply/abc123def456",
};

// The dismissal routes that are a CLICK on something. Escape is a fourth route
// and is deliberately not in this list: it is native to `<dialog>` (it fires
// `cancel`, then `close`) rather than a click on an element, so it is covered by
// its own pair of tests below — same guard, different mechanism.
const dismissRoutes = [
	["the backdrop", () => screen.getByRole("dialog")],
	["the X", () => screen.getByRole("button", { name: /close/i })],
	["Cancel", () => screen.getByRole("button", { name: /cancel/i })],
] as const;

describe("NewBorrowerExperienceModal", () => {
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
		render(
			<NewBorrowerExperienceModal open onClose={() => {}} products={products} onCreate={create} />,
		);
		await userEvent.click(screen.getByRole("button", { name: /create link/i }));
		expect(create).not.toHaveBeenCalled();
		expect(screen.getByText(/name this link/i)).toBeInTheDocument();
	});

	it("submits the selected product and label", async () => {
		const create = vi.fn().mockResolvedValue(PORTAL);
		render(
			<NewBorrowerExperienceModal open onClose={() => {}} products={products} onCreate={create} />,
		);
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
		render(
			<NewBorrowerExperienceModal open onClose={() => {}} products={products} onCreate={create} />,
		);
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
		render(
			<NewBorrowerExperienceModal open onClose={() => {}} products={products} onCreate={create} />,
		);
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
		render(
			<NewBorrowerExperienceModal open onClose={onClose} products={products} onCreate={create} />,
		);
		await userEvent.type(screen.getByLabelText(/name/i), "x");
		await userEvent.click(screen.getByRole("button", { name: /create link/i }));
		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/unknown/i));
		expect(onClose).not.toHaveBeenCalled();
		// Still on the form, so the operator can fix the input and retry.
		expect(screen.getByRole("button", { name: /create link/i })).toBeInTheDocument();
	});

	it("starts a fresh form when reopened after a link was made", async () => {
		const create = vi.fn().mockResolvedValue(PORTAL);
		const { rerender } = render(
			<NewBorrowerExperienceModal open onClose={() => {}} products={products} onCreate={create} />,
		);
		await userEvent.type(screen.getByLabelText(/name/i), "first link");
		await userEvent.click(screen.getByRole("button", { name: /create link/i }));
		await waitFor(() => expect(screen.getByDisplayValue(PORTAL.url)).toBeInTheDocument());

		const props = { products, onCreate: create, onClose: () => {} };
		rerender(<NewBorrowerExperienceModal open={false} {...props} />);
		rerender(<NewBorrowerExperienceModal open {...props} />);

		expect(screen.queryByDisplayValue(PORTAL.url)).toBeNull();
		expect(screen.getByLabelText(/name/i)).toHaveValue("");
	});

	// POSITIVE CONTROL for the in-flight test below. Asserting only "onClose was
	// not called while busy" would pass just as well against a modal that can
	// never be closed at all, so each route is first proven to work.
	it.each(dismissRoutes)("closes through %s when nothing is in flight", async (_name, target) => {
		const onClose = vi.fn();
		render(
			<NewBorrowerExperienceModal open onClose={onClose} products={products} onCreate={vi.fn()} />,
		);
		await userEvent.click(target());
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("refuses every dismissal route while the create is in flight, and allows them again once it settles", async () => {
		// A deferred promise, not `mockResolvedValue`: `busy` is only observable
		// while `onCreate` is still pending.
		// Real timers, so `CREATE_DEADLINE_MS` is genuinely running underneath
		// this test: it stays green because the whole test finishes in
		// milliseconds, far inside that window. Cutting the deadline to a couple
		// of seconds would make this flaky under load — which is one reason it is
		// generous.
		let release: (portal: typeof PORTAL) => void = () => {};
		const create = vi.fn(
			() =>
				new Promise<typeof PORTAL>((resolve) => {
					release = resolve;
				}),
		);
		const onClose = vi.fn();
		render(
			<NewBorrowerExperienceModal open onClose={onClose} products={products} onCreate={create} />,
		);
		await userEvent.type(screen.getByLabelText(/name/i), "in flight");
		await userEvent.click(screen.getByRole("button", { name: /create link/i }));
		await waitFor(() => expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled());

		// Visibly refused, not silently: the two dismissal buttons are disabled
		// too, so the operator is not clicking a live-looking control.
		expect(screen.getByRole("button", { name: /close/i })).toBeDisabled();
		expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();

		for (const [, target] of dismissRoutes) {
			await userEvent.click(target());
		}
		// The POST may already have minted the portal; its URL is only ever shown
		// on this dialog, so closing now would strand a live link.
		expect(onClose).not.toHaveBeenCalled();
		expect(screen.getByRole("dialog")).toBeInTheDocument();

		release(PORTAL);
		await waitFor(() => expect(screen.getByDisplayValue(PORTAL.url)).toBeInTheDocument());
		// The guard releases: the same X that was inert a moment ago now closes.
		await userEvent.click(screen.getByRole("button", { name: /close/i }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	/**
	 * Escape, which the browser owns.
	 *
	 * `showModal()` makes Escape a real dismissal route — the UA fires `cancel`,
	 * and if nothing prevents it, `close`. That is the route the component wires
	 * `onClose` to, and it is also the one route the `busy` guard has to reach
	 * without an `onClick` to hang off: it guards `cancel` instead.
	 *
	 * happy-dom does not translate a key press into `cancel`, so these dispatch
	 * the two native events directly and read what the component did with them —
	 * `defaultPrevented` for the refusal, and the `close` wiring for the pass.
	 */
	it("Escape closes when nothing is in flight", async () => {
		const onClose = vi.fn();
		render(
			<NewBorrowerExperienceModal open onClose={onClose} products={products} onCreate={vi.fn()} />,
		);
		const dialog = screen.getByRole("dialog");

		// Not refused: the UA is left free to go on and close the dialog…
		const cancelled = dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
		expect(cancelled).toBe(true);
		// …and when it does, that native close is what reaches the host.
		dialog.dispatchEvent(new Event("close"));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("Escape is refused while the create is in flight", async () => {
		let release: (portal: typeof PORTAL) => void = () => {};
		const create = vi.fn(
			() =>
				new Promise<typeof PORTAL>((resolve) => {
					release = resolve;
				}),
		);
		const onClose = vi.fn();
		render(
			<NewBorrowerExperienceModal open onClose={onClose} products={products} onCreate={create} />,
		);
		await userEvent.type(screen.getByLabelText(/name/i), "in flight");
		await userEvent.click(screen.getByRole("button", { name: /create link/i }));
		await waitFor(() => expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled());

		const dialog = screen.getByRole("dialog");
		expect(dialog.dispatchEvent(new Event("cancel", { cancelable: true }))).toBe(false);
		expect(onClose).not.toHaveBeenCalled();

		// The guard has a ceiling, and the test above is its positive control:
		// once the create settles, the same event is let through again.
		release(PORTAL);
		await waitFor(() => expect(screen.getByDisplayValue(PORTAL.url)).toBeInTheDocument());
		expect(dialog.dispatchEvent(new Event("cancel", { cancelable: true }))).toBe(true);
	});

	/**
	 * The layout contract of the native `<dialog>` — asserted as classes, which
	 * is normally a smell, except that the regression it guards WAS a class
	 * string.
	 *
	 * When this modal moved from a `fixed inset-0 flex items-center
	 * justify-center` backdrop div to `showModal()`, the wrapper's classes came
	 * with it. A `showModal()`ed dialog is not a wrapper AROUND a card, it IS the
	 * card: the UA centres it with `margin: auto` against `inset: 0`, so `m-0`
	 * over-constrains it into a box pinned to the top-left corner, `max-w-none`
	 * lets it fill the viewport, and `bg-black/50` tints the card instead of
	 * dimming the page. Every test in this file stayed green throughout, because
	 * happy-dom computes no layout — the class string is the only part of this an
	 * in-process test can hold. (The geometry itself was checked in Chrome.)
	 */
	it("is a centred, bounded box dimmed by ::backdrop, not a full-viewport wrapper", () => {
		render(
			<NewBorrowerExperienceModal open onClose={() => {}} products={products} onCreate={vi.fn()} />,
		);
		const dialog = screen.getByRole("dialog");
		const classes = dialog.className.split(/\s+/);

		// Tailwind preflight resets `margin: 0` on `*`, so the UA's centring has
		// to be put back explicitly or the box pins to the corner.
		expect(classes).toContain("m-auto");
		// Bounded on both axes, so it is sized to its content, not the viewport.
		expect(classes).toContain("max-w-md");
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

	it("scrolls its body rather than outgrowing the viewport", () => {
		render(
			<NewBorrowerExperienceModal open onClose={() => {}} products={products} onCreate={vi.fn()} />,
		);
		const dialog = screen.getByRole("dialog");
		expect(dialog.className.split(/\s+/)).toContain("overflow-hidden");

		const scroller = screen.getByLabelText(/name/i).closest(".overflow-y-auto");
		expect(scroller).not.toBeNull();
		expect(dialog.contains(scroller)).toBe(true);
		// `min-h-0` is what lets `overflow-y-auto` ever have an overflow: a flex
		// child's default `min-height: auto` refuses to shrink below its content,
		// so without it the dialog grows past `max-h-[85vh]` and nothing scrolls.
		const scrollerClasses = (scroller as HTMLElement).className.split(/\s+/);
		expect(scrollerClasses).toContain("min-h-0");
		expect(scrollerClasses).toContain("flex-1");
	});

	it("will not submit when there is no product to submit under", async () => {
		const create = vi.fn().mockResolvedValue(PORTAL);
		const { unmount } = render(
			<NewBorrowerExperienceModal open onClose={() => {}} products={[]} onCreate={create} />,
		);
		await userEvent.type(screen.getByLabelText(/name/i), "no product");
		expect(screen.getByRole("button", { name: /create link/i })).toBeDisabled();
		await userEvent.click(screen.getByRole("button", { name: /create link/i }));
		// Otherwise this POSTs `product_id: ""` and the operator reads the server's
		// "Unknown or disabled product:" with a blank tail.
		expect(create).not.toHaveBeenCalled();
		unmount();

		// Positive control: the same button, with a product list, is live.
		render(
			<NewBorrowerExperienceModal open onClose={() => {}} products={products} onCreate={create} />,
		);
		await userEvent.type(screen.getByLabelText(/name/i), "has product");
		expect(screen.getByRole("button", { name: /create link/i })).toBeEnabled();
		await userEvent.click(screen.getByRole("button", { name: /create link/i }));
		await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
	});

	it("hands every dismissal route back when the create never settles", async () => {
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
			// The case the guard alone could not escape: a promise that never
			// settles, so `busy` is never cleared by the request.
			const create = vi.fn(() => new Promise<never>(() => {}));
			render(
				<NewBorrowerExperienceModal open onClose={onClose} products={products} onCreate={create} />,
			);
			await user.type(screen.getByLabelText(/name/i), "hung");
			await user.click(screen.getByRole("button", { name: /create link/i }));

			// Still refused while the create is in flight — the fix this bounds is
			// intact, not traded away.
			expect(screen.getByRole("button", { name: /close/i })).toBeDisabled();
			for (const [, target] of dismissRoutes) {
				await user.click(target());
			}
			expect(onClose).not.toHaveBeenCalled();

			// Half the window: still refused, so the release below is the deadline
			// firing and not merely "some time passed". Half rather than
			// `CREATE_DEADLINE_MS - 1` because `shouldAdvanceTime` lets real
			// elapsed milliseconds onto the same clock, and the interactions above
			// have already spent some of them.
			await act(async () => {
				await vi.advanceTimersByTimeAsync(CREATE_DEADLINE_MS / 2);
			});
			expect(screen.getByRole("button", { name: /close/i })).toBeDisabled();
			expect(onClose).not.toHaveBeenCalled();

			await act(async () => {
				await vi.advanceTimersByTimeAsync(CREATE_DEADLINE_MS);
			});

			// The operator is told what happened rather than silently released:
			// the POST was abandoned, not cancelled, so a link may exist.
			expect(screen.getByRole("alert")).toHaveTextContent(/did not answer in time/i);
			expect(screen.getByRole("button", { name: /close/i })).toBeEnabled();
			expect(screen.getByRole("button", { name: /cancel/i })).toBeEnabled();
			await user.click(screen.getByRole("button", { name: /close/i }));
			expect(onClose).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	// The other end of the deadline: the timer outlives `submit()` while the
	// create is in flight, because `finally` does not run until the race settles.
	// Unmount is the one dismissal route `requestClose` cannot refuse, so it is
	// the one that has to clear the timer instead.
	it("clears the deadline timer when the dialog is unmounted mid-flight", () => {
		// Plain fake timers and `fireEvent`, not `shouldAdvanceTime` + `userEvent`
		// as the test above uses: this test COUNTS timers, and userEvent schedules
		// its own inter-event `setTimeout`s. With `fireEvent` the deadline is the
		// only timer in flight, so the counts below are exact rather than a floor.
		vi.useFakeTimers();
		try {
			const create = vi.fn(() => new Promise<never>(() => {}));
			const { unmount } = render(
				<NewBorrowerExperienceModal
					open
					onClose={() => {}}
					products={products}
					onCreate={create}
				/>,
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
		render(
			<NewBorrowerExperienceModal open onClose={() => {}} products={products} onCreate={create} />,
		);
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
