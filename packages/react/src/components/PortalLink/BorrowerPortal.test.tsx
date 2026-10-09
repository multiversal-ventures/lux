import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../hooks/usePortalSession.js", () => ({ usePortalSession: vi.fn() }));

import { usePortalSession } from "../../hooks/usePortalSession.js";
import { BorrowerPortal } from "./BorrowerPortal";

const mockUsePortalSession = usePortalSession as unknown as Mock;

/** A server-minted case address: `{case_id}-{hmac tag}@{inbound domain}`. */
const ADDRESS = "9f2c1b4e-7c33-4c1a-9a55-0f1d2e3a4b5c-a41b7e0c92@mail.example.com";

/**
 * A session parked on step 4 — the chat — which is the only step that renders a
 * composer or a thread. `step` is
 * `!verified ? 1 : (!accountDone && !skippedAccount) ? 2 : !signed ? 3 : 4`, and
 * steps 1–3 return early from a different branch entirely, so all three of
 * `verification.verified` / `has_account` / `signed` have to be true or none of
 * these assertions are about the code they name.
 *
 * Every negative case below is this same object spread with ONE field changed,
 * so "nothing rendered" can only mean the gate fired — never that the fixture
 * failed to reach step 4.
 */
function step4Session(overrides: Record<string, unknown> = {}) {
	return {
		session_id: "sess-1",
		case_id: "9f2c1b4e-7c33-4c1a-9a55-0f1d2e3a4b5c",
		case_state: "active",
		entity: { name: "Jane Borrower" },
		verification: { verified: true, level: 2 },
		has_account: true,
		signed: true,
		submitted: false,
		requires_code: false,
		account_email: "jane@example.com",
		officer_name: "Sam Officer",
		officer_avatar: "",
		requested_by: "Sam Officer",
		request_message: "",
		thread: [],
		thread_has_more: false,
		uploaded_files: [],
		checklist: [],
		kba_questions: [],
		verify_proof: "",
		inbound_email_address: ADDRESS,
		...overrides,
	};
}

function officerMessage() {
	return {
		message_id: "m1",
		author_kind: "operator",
		kind: "message",
		body: "Welcome — please send your bank statements.",
		created_at: "2026-08-25T10:00:00Z",
		read: true,
		edited: false,
		deleted: false,
		items: [],
		seq: 1,
	};
}

function mountWith(session: Record<string, unknown>) {
	mockUsePortalSession.mockReturnValue({
		session,
		loading: false,
		error: null,
		uploadError: null,
		clearUploadError: vi.fn(),
		submitIntent: vi.fn(),
		uploadDocuments: vi.fn(),
		operatorTyping: false,
		sendTyping: vi.fn(),
		loadMessagesBefore: vi.fn(),
	});
	return render(<BorrowerPortal token="tok" />);
}

/** Every anchor the page offers that opens a mail client. The negative cases
 * below count these rather than querying the two known render sites by name, so
 * a third site added later is covered too. It is a check on the affordance, not
 * a proof that the string appears nowhere in the DOM. */
function mailtoLinks(): HTMLAnchorElement[] {
	return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]'));
}

describe("BorrowerPortal inbound email address", () => {
	beforeEach(() => {
		mockUsePortalSession.mockReset();
	});

	it("offers the address beside the upload control and in the empty thread", () => {
		mountWith(step4Session());

		// The upload control itself, asserted so "beside it" is a claim about a
		// composer that actually rendered.
		expect(screen.getByLabelText("Attach documents")).toBeInTheDocument();
		const composerLink = screen.getByRole("link", { name: "Email your documents" });
		expect(composerLink).toHaveAttribute(
			"href",
			`mailto:${ADDRESS}?subject=Documents%20for%20my%20application`,
		);

		// The address rides in the href, which is where it has to be, and not in
		// THIS control's accessible name — an icon-only control should announce its
		// purpose rather than spell an address out on every focus. That is a
		// legibility choice, not a secrecy one: the empty-state link asserted below
		// has the address as its accessible name, deliberately.
		expect(composerLink).toHaveAccessibleName("Email your documents");
		expect(composerLink.textContent ?? "").not.toContain(ADDRESS);

		// The empty state shows it as readable, copyable text, because the point
		// is for the borrower to be able to mail it from their own device.
		expect(screen.getByText("No messages yet.")).toBeInTheDocument();
		const emptyStateLink = screen.getByRole("link", { name: ADDRESS });
		expect(emptyStateLink).toHaveAttribute(
			"href",
			`mailto:${ADDRESS}?subject=Documents%20for%20my%20application`,
		);
		// Here the address IS both the text and the accessible name, so a screen
		// reader on this screen reads it out. That is the intent, not an oversight:
		// hiding it behind a label would leave a borrower using assistive tech
		// unable to hear the one string the feature exists to hand them. The
		// comment at the composer's render site cites this assertion by name.
		expect(emptyStateLink).toHaveAccessibleName(ADDRESS);
		expect(emptyStateLink.textContent).toBe(ADDRESS);
	});

	it("keeps the composer's offer once the thread has messages", () => {
		mountWith(step4Session({ thread: [officerMessage()] }));

		// The precondition this test's name rests on, asserted rather than assumed:
		// the thread really did render a message.
		expect(screen.getByText(/bank statements/i)).toBeInTheDocument();
		// The empty-state copy is gone …
		expect(screen.queryByText("No messages yet.")).toBeNull();
		expect(screen.queryByRole("link", { name: ADDRESS })).toBeNull();
		// … and the composer's is not, which is what would break if it were ever
		// nested inside the empty-state block by accident.
		expect(screen.getByRole("link", { name: "Email your documents" })).toHaveAttribute(
			"href",
			`mailto:${ADDRESS}?subject=Documents%20for%20my%20application`,
		);
	});

	// `null` is what every deployment returns today (the receiving mail domain is
	// unconfigured), and the field is simply absent from any server predating it.
	// Both must render nothing at all — not a disabled control, not a placeholder,
	// and above all not an address composed on the client.
	it.each([
		["null", () => step4Session({ inbound_email_address: null })],
		// Built by omitting the key, not by spreading `{ inbound_email_address:
		// undefined }` over the fixture — that leaves the key present and set to
		// `undefined`, which is not the wire shape a server predating the field
		// sends. The `&&` gate cannot tell them apart, but the case is named for
		// the wire shape, so it should be the wire shape.
		[
			"absent",
			() => {
				const { inbound_email_address: _omitted, ...withoutTheField } = step4Session();
				return withoutTheField;
			},
		],
	])("renders no email affordance at all when the address is %s", (_name, build) => {
		const { unmount } = mountWith(build());

		expect(screen.queryByRole("link", { name: "Email your documents" })).toBeNull();
		// `mailtoLinks()` is the whole requirement — deliberately not a
		// `queryByText(/email/i)` over the tree, which would assert the absence of
		// a common word and misfire on unrelated copy.
		expect(mailtoLinks()).toHaveLength(0);
		// The gate is the only thing that differs: this is the same step-4 chat,
		// with the same composer, that renders both affordances below.
		expect(screen.getByLabelText("Attach documents")).toBeInTheDocument();
		expect(screen.getByText("No messages yet.")).toBeInTheDocument();

		unmount();

		// POSITIVE CONTROL, same setup, one field changed. Without it "queryBy…
		// is null" would pass just as well against a component that can never
		// render the address at all.
		mountWith(step4Session());
		expect(screen.getByRole("link", { name: "Email your documents" })).toBeInTheDocument();
		expect(mailtoLinks()).toHaveLength(2);
	});

	// Neither of these is a value the server produces — `configured_inbound_address`
	// returns `None` unless the domain is non-blank — but a blank-ish value must
	// never become `mailto:?subject=…` or `mailto:   ?subject=…`, an address-less
	// compose window that looks like the feature working. `""` is caught by the
	// truthiness gate alone; `"   "` is one space away from it and needs the trim,
	// so both cases are here rather than only the one the gate already handled.
	it.each([
		["an empty", ""],
		["a whitespace-only", "   "],
	])("renders nothing for %s address rather than an empty mailto", (_name, address) => {
		mountWith(step4Session({ inbound_email_address: address }));

		expect(mailtoLinks()).toHaveLength(0);
		// Proves the fixture still reached step 4, so "no mailto" is the gate
		// firing and not a chat that never rendered.
		expect(screen.getByText("No messages yet.")).toBeInTheDocument();
	});

	// The identity gate, pinned structurally rather than incidentally. On the
	// server the property is explicit (`if not verified:` returns above the mint);
	// here it is a consequence of `step`, which is 1 for an unverified borrower,
	// and steps 1–3 return from a branch that renders neither composer nor thread.
	// Nothing downstream re-checks verification, so without this test a refactor
	// that hoisted the composer would hand the address to an unverified caller
	// with the suite still green.
	//
	// The fixture is deliberately `has_account: true, signed: true` with ONLY
	// `verified` flipped: delete `!verified ?` from the step ternary and this
	// lands on step 4, where both affordances render and the assertions below
	// fail. A fixture that also withheld the account would land on step 2 on that
	// same edit — still no mailto, still green, and the gate unpinned.
	it("renders no email affordance for an unverified borrower", () => {
		const { unmount } = mountWith(step4Session({ verification: { verified: false, level: 0 } }));

		// Where it stopped, asserted — so "no mailto" cannot mean "nothing
		// rendered at all".
		expect(screen.getByRole("heading", { name: /enter your access code/i })).toBeInTheDocument();
		expect(mailtoLinks()).toHaveLength(0);
		expect(screen.queryByLabelText("Attach documents")).toBeNull();

		unmount();

		// POSITIVE CONTROL: the same fixture with verification restored, which is
		// the only difference between the two mounts.
		mountWith(step4Session());
		expect(mailtoLinks()).toHaveLength(2);
	});
});

/**
 * A session parked on step 2 — the account step, the only step where
 * `AccountStep` renders. Reached via `verified: true, has_account: false`;
 * `signed` doesn't matter because the step ternary short-circuits at 2 first.
 */
function step2Session(overrides: Record<string, unknown> = {}) {
	return step4Session({
		has_account: false,
		signed: false,
		account_email: null,
		...overrides,
	});
}

function mountAccountStep(
	session: Record<string, unknown>,
	options: { onCreateAccount?: (email: string) => Promise<void>; submitIntent?: Mock } = {},
) {
	const submitIntent = options.submitIntent ?? vi.fn().mockResolvedValue(undefined);
	mockUsePortalSession.mockReturnValue({
		session,
		loading: false,
		error: null,
		uploadError: null,
		clearUploadError: vi.fn(),
		submitIntent,
		uploadDocuments: vi.fn(),
		operatorTyping: false,
		sendTyping: vi.fn(),
		loadMessagesBefore: vi.fn(),
	});
	// `onCreateAccount={undefined}` is indistinguishable from omitting the prop
	// — both leave it `undefined` on the component — so this is the real
	// "host supplied no hook" wire shape, not a stand-in for it.
	return render(<BorrowerPortal token="tok" onCreateAccount={options.onCreateAccount} />);
}

const SIGN_STEP_HEADING = /consent & e-signature/i;
const SENT_HEADING = /email sent — check your inbox/i;
const SPAM_HINT = /check your spam or junk folder/i;
const SIGN_IN_LINK_COPY = /secure sign-in link/i;
const REMEMBER_EMAIL_COPY = /we'll remember your email so you can pick up where you left off/i;

describe("BorrowerPortal account step — onCreateAccount gating", () => {
	beforeEach(() => {
		mockUsePortalSession.mockReset();
	});

	it("POSITIVE CONTROL: with onCreateAccount supplied, submitting shows the sent state and parks", async () => {
		const user = userEvent.setup();
		const onCreateAccount = vi.fn().mockResolvedValue(undefined);
		mountAccountStep(step2Session(), { onCreateAccount });

		// Before submitting: the pre-submit copy itself promises a sign-in link
		// (this is the only claim that's true here — the hook exists to keep it).
		expect(screen.getByText(SIGN_IN_LINK_COPY)).toBeInTheDocument();

		await user.type(screen.getByPlaceholderText("you@example.com"), "jane@example.com");
		await user.click(screen.getByRole("button", { name: /continue/i }));

		// All three sent-state affordances are present — this is the fixture
		// that makes the no-hook path's absence assertions below mean something.
		// Without this test, a component that renders nothing at all for the
		// account step would pass those assertions equally well.
		await waitFor(() => {
			expect(screen.getByRole("heading", { name: SENT_HEADING })).toBeInTheDocument();
		});
		expect(screen.getByText(SPAM_HINT)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /resend email/i })).toBeInTheDocument();
		expect(onCreateAccount).toHaveBeenCalledWith("jane@example.com");

		// Parked: the step does not advance on its own. Nothing here can flip
		// `session.has_account`, so the sign step must not have rendered.
		expect(screen.queryByRole("heading", { name: SIGN_STEP_HEADING })).toBeNull();
	});

	it("with no onCreateAccount, submitting shows no email-sent claim and advances instead of parking", async () => {
		const user = userEvent.setup();
		mountAccountStep(step2Session());

		// Before submitting: the honest copy is present, and the sign-in-link
		// claim — which nothing on this host can fulfil — is not. This is
		// asserted while AccountStep is still mounted, independent of whatever
		// happens on submit, so it can't pass merely because the step advanced.
		expect(screen.getByText(REMEMBER_EMAIL_COPY)).toBeInTheDocument();
		expect(screen.queryByText(SIGN_IN_LINK_COPY)).toBeNull();

		await user.type(screen.getByPlaceholderText("you@example.com"), "jane@example.com");
		await user.click(screen.getByRole("button", { name: /continue/i }));

		// The step completes on submit rather than waiting — proof it didn't
		// park is that the next step actually rendered.
		await waitFor(() => {
			expect(screen.getByRole("heading", { name: SIGN_STEP_HEADING })).toBeInTheDocument();
		});

		// No claim of a sent email anywhere in the tree — not the heading, not
		// the spam hint, not a Resend control.
		expect(screen.queryByRole("heading", { name: SENT_HEADING })).toBeNull();
		expect(screen.queryByText(SPAM_HINT)).toBeNull();
		expect(screen.queryByRole("button", { name: /resend email/i })).toBeNull();
	});

	it("POSITIVE CONTROL: Skip advances past the account step when onCreateAccount is supplied", async () => {
		const user = userEvent.setup();
		mountAccountStep(step2Session(), { onCreateAccount: vi.fn().mockResolvedValue(undefined) });

		await user.click(screen.getByRole("button", { name: /skip for now/i }));

		expect(screen.getByRole("heading", { name: SIGN_STEP_HEADING })).toBeInTheDocument();
	});

	it("Skip advances past the account step when there is no onCreateAccount", async () => {
		const user = userEvent.setup();
		mountAccountStep(step2Session());

		await user.click(screen.getByRole("button", { name: /skip for now/i }));

		expect(screen.getByRole("heading", { name: SIGN_STEP_HEADING })).toBeInTheDocument();
	});
});

// ─── The loan status card and the "My loans" control ─────────────────────────

/** The three additive session blocks, as a verified session carries them. */
const LOAN_STATUS = {
	key: "documents_needed",
	label: "Additional documents needed",
	tone: "warning",
	description: "Your loan officer needs a few more documents.",
	action_count: 2,
};

const LOAN_SUMMARY = {
	property_label: "412 Alder St, Portland OR",
	product_label: "DSCR (Investment Property)",
	fields: [{ label: "Loan amount", display: "$420,000" }],
};

function mountHub(overrides: Record<string, unknown> = {}, props: { onBack?: () => void } = {}) {
	mockUsePortalSession.mockReturnValue({
		session: step4Session(overrides),
		loading: false,
		error: null,
		uploadError: null,
		clearUploadError: vi.fn(),
		submitIntent: vi.fn(),
		uploadDocuments: vi.fn(),
		operatorTyping: false,
		sendTyping: vi.fn(),
		loadMessagesBefore: vi.fn(),
	});
	return render(<BorrowerPortal token="tok" onBack={props.onBack} />);
}

describe("BorrowerPortal loan status card", () => {
	it("puts the loan status card above the thread and outside its scroller", () => {
		mountHub({ loan_status: LOAN_STATUS, loan_summary: LOAN_SUMMARY });

		const card = screen.getByTestId("loan-status-card");
		expect(card).toBeInTheDocument();
		expect(screen.getByText("Additional documents needed")).toBeInTheDocument();

		// Same property as before, re-expressed against the new layout: the page
		// scrolls as a whole now and the conversation scrolls inside its own card,
		// so "not in the scroll container" is a claim about THAT scroller — a card
		// inside it would scroll away with the thread. Queried by test id rather
		// than by `.overflow-y-auto`, which the page scroller also carries.
		const thread = screen.getByTestId("thread-scroll");
		expect(thread.className).toContain("overflow-y-auto");
		expect(thread.contains(card)).toBe(false);
		// And it is ABOVE the thread, not merely outside it: nothing auto-scrolls
		// the page, so first paint shows the status card.
		expect(card.compareDocumentPosition(thread) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it("renders no status card when the session has no loan_status", () => {
		// An older veritas, or a case with no portal party: the three fields are
		// additive and nullable, and the hub must render without them.
		mountHub();
		expect(screen.queryByTestId("loan-status-card")).not.toBeInTheDocument();
	});

	it("shows a My loans control when onBack is given", async () => {
		const onBack = vi.fn();
		mountHub({ loan_status: LOAN_STATUS }, { onBack });
		await userEvent.click(screen.getByRole("button", { name: /my loans/i }));
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it("shows none when it is not", () => {
		mountHub({ loan_status: LOAN_STATUS });
		expect(screen.queryByRole("button", { name: /my loans/i })).not.toBeInTheDocument();
	});
});

// ─── One count, one next action ───────────────────────────────────────────────

/** An officer's hand-picked request items, as the session carries them: the
 * server builds this list from the latest SENT request and stamps every row
 * `status: "needed"`, whether or not that request is still open. */
const REQUEST_ITEMS = [
	{
		id: "r1",
		title: "Property appraisal",
		detail: "The full PDF.",
		status: "needed",
		priority: "high",
		action: "Upload",
	},
	{
		id: "r2",
		title: "Property tax bill",
		detail: "Most recent year.",
		status: "needed",
		priority: "high",
		action: "Upload",
	},
];

describe("BorrowerPortal — how much is outstanding", () => {
	beforeEach(() => {
		mockUsePortalSession.mockReset();
	});

	it("drives the header line, the card's pill and the next step from action_count", () => {
		mountHub({
			loan_status: { ...LOAN_STATUS, action_count: 2 },
			loan_summary: LOAN_SUMMARY,
			checklist: REQUEST_ITEMS,
		});

		// The header counted open request MESSAGES in the thread and said "All
		// caught up" while the list below asked for two documents. There is one
		// field for this now, and all three readings of it agree.
		expect(screen.getByText("Action needed")).toBeInTheDocument();
		// The count itself is printed exactly once, by the card's action pill.
		expect(screen.getAllByText("2 actions needed")).toHaveLength(1);
		expect(screen.getByText("Next step")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Upload documents" })).toBeInTheDocument();
		expect(screen.getByText("Property appraisal")).toBeInTheDocument();
		expect(screen.getByText("Property tax bill")).toBeInTheDocument();
		// Nothing anywhere says the borrower is done while two documents are owed.
		expect(screen.queryByText(/nothing/i)).toBeNull();
	});

	it("says nothing is outstanding — once, and only when nothing is", () => {
		// Nothing asked and nothing listed: one line, no card, nothing to press.
		mountHub({
			loan_status: {
				...LOAN_STATUS,
				key: "under_review",
				label: "Under review",
				tone: "info",
				action_count: 0,
			},
			loan_summary: LOAN_SUMMARY,
			checklist: [],
		});

		expect(screen.getByText("Under review")).toBeInTheDocument();
		expect(screen.getByText("Nothing needed from you right now")).toBeInTheDocument();
		expect(screen.getByText(/nothing to do right now/i)).toBeInTheDocument();
		expect(screen.queryByText("Next step")).toBeNull();
		expect(screen.queryByRole("button", { name: "Upload documents" })).toBeNull();
		expect(screen.queryByText(/actions? needed/i)).toBeNull();
		// The composer's own attach control is NOT gated on an open request — it is
		// how a borrower sends something the officer asked for in chat.
		expect(screen.getByLabelText("Attach documents")).toBeInTheDocument();
	});

	it("lists a generated product checklist, which the server publishes with action_count 0", () => {
		// The case this page shipped broken, and the reason the rows are NOT gated
		// on the count: `write_checklist` persists the product's resolved document
		// asks as a `portal_requests` row and writes no request MESSAGE, so
		// `action_count` — items on open messages — is 0 while four documents are
		// genuinely owed. The old header read the same empty message list and said
		// "All caught up" over four cards tagged "high". Now every part of the page
		// says the same thing: there is something to do, and no number is invented
		// for it.
		mountHub({
			loan_status: {
				key: "in_progress",
				label: "Application in progress",
				tone: "neutral",
				description: "Finish your application and upload the documents listed below.",
				action_count: 0,
			},
			loan_summary: LOAN_SUMMARY,
			checklist: REQUEST_ITEMS,
		});

		// Listed, uploadable, and described in the past tense: these were asked
		// for, and no field says which are still owed, so the page claims neither.
		// "Next step" is the imperative voice and belongs to a real count.
		expect(screen.getByText("Documents requested")).toBeInTheDocument();
		expect(screen.getByText("Requested documents")).toBeInTheDocument();
		expect(screen.queryByText("Next step")).toBeNull();
		expect(screen.getByText("Property appraisal")).toBeInTheDocument();
		expect(screen.getByText("Property tax bill")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Upload documents" })).toBeInTheDocument();
		// Nothing claims they are done, and no count is invented: the pill that
		// prints the NUMBER stays away because the server published none.
		expect(screen.queryByText(/nothing/i)).toBeNull();
		expect(screen.queryByText(/\d+ actions? needed/i)).toBeNull();
	});

	it("keeps a decision's outstanding conditions and the upload step on the same page", () => {
		// A published decision goes out over the party-request path, so its
		// conditions are BOTH the decision snapshot the card renders and the open
		// request the count and the checklist come from. The card's pointer at
		// "Next step" has to find a Next step.
		mountHub({
			loan_status: {
				key: "conditionally_approved",
				label: "Conditionally approved",
				tone: "success",
				description: "Your loan is approved subject to the conditions below.",
				action_count: 1,
			},
			loan_summary: LOAN_SUMMARY,
			decision: {
				kind: "conditionally_approved",
				label: "Conditionally approved",
				tone: "success",
				decided_at: "2026-10-02T17:30:00Z",
				decided_by_name: "Dana Reyes",
				message: "We're clear to proceed once we have the binder.",
				terms: [{ label: "DSCR", display: "1.28" }],
				conditions: [{ title: "Hazard insurance binder", detail: "" }],
				conditions_state: "outstanding",
			},
			checklist: [{ ...REQUEST_ITEMS[0], title: "Hazard insurance binder" }],
		});

		expect(screen.getByText("1 action needed")).toBeInTheDocument();
		expect(screen.getByText("Outstanding")).toBeInTheDocument();
		// The SAME condition is both the decision snapshot (what was promised,
		// immutable) and the open request (what to do now), so its title appears
		// twice by design — in the hero's Conditions and in the Next step list.
		expect(screen.getAllByText("Hazard insurance binder")).toHaveLength(2);
		expect(screen.getByText("Upload them under Next step below.")).toBeInTheDocument();
		expect(screen.getByText("Next step")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Upload documents" })).toBeInTheDocument();
		// The terms snapshot is rendered as given, never reformatted.
		expect(screen.getByText("1.28")).toBeInTheDocument();
	});

	it("still lists the request when the server sends no loan_status at all", () => {
		// A server predating `loan_status` publishes no count. Absent is not zero:
		// the rows are then the only evidence of what is outstanding, so they are
		// shown — with no count printed anywhere, because none was sent.
		mountHub({ checklist: REQUEST_ITEMS });

		expect(screen.queryByTestId("loan-status-card")).not.toBeInTheDocument();
		expect(screen.getByText("Requested documents")).toBeInTheDocument();
		expect(screen.getByText("Property appraisal")).toBeInTheDocument();
		expect(screen.getByText("Documents requested")).toBeInTheDocument();
		// No count was sent, so none is invented.
		expect(screen.queryByText(/\d+ actions? needed/i)).toBeNull();
		expect(screen.queryByText(/nothing/i)).toBeNull();
	});

	it("drops the priority tag when every item carries the same priority", () => {
		// "high" on all four documents was the state this shipped in, and it told
		// the borrower nothing. The tag survives only where the items differ.
		const { unmount } = mountHub({
			loan_status: { ...LOAN_STATUS, action_count: 2 },
			checklist: REQUEST_ITEMS,
		});
		expect(screen.queryByText("high")).toBeNull();

		unmount();

		// POSITIVE CONTROL: same list, one row's priority changed.
		mountHub({
			loan_status: { ...LOAN_STATUS, action_count: 2 },
			checklist: [REQUEST_ITEMS[0], { ...REQUEST_ITEMS[1], priority: "medium" }],
		});
		expect(screen.getByText("high")).toBeInTheDocument();
		expect(screen.getByText("medium")).toBeInTheDocument();
	});

	it("offers the submit control only once something has been uploaded against an open ask", () => {
		const { unmount } = mountHub({
			loan_status: { ...LOAN_STATUS, action_count: 2 },
			checklist: REQUEST_ITEMS,
		});
		expect(screen.queryByRole("button", { name: /sent everything/i })).toBeNull();

		unmount();

		mountHub({
			loan_status: { ...LOAN_STATUS, action_count: 2 },
			checklist: REQUEST_ITEMS,
			uploaded_files: ["appraisal.pdf"],
		});
		expect(screen.getByRole("button", { name: /sent everything/i })).toBeInTheDocument();
	});

	it("withholds submit when there is no open ask for it to fulfil", () => {
		// This is the screen that was reported: a settled case, no open request,
		// and a generated checklist that outlived it. Submit marks this party's
		// OPEN request messages fulfilled (veritas `_handle_submit_intent`), so
		// with none open it fulfils nothing and is not offered. The old gate
		// counted open request messages and had this property by accident; it is
		// explicit now.
		mountHub({
			loan_status: {
				...LOAN_STATUS,
				key: "under_review",
				label: "Under review",
				tone: "info",
				description: "Your loan officer is reviewing your file.",
				action_count: 0,
			},
			loan_summary: LOAN_SUMMARY,
			checklist: REQUEST_ITEMS,
			uploaded_files: ["property_tax_bill.pdf"],
		});

		// The hero and the list no longer argue: the hero says the file is being
		// reviewed, the list says these documents were asked for, and nothing says
		// "all caught up" or "do four urgent things".
		expect(screen.getByText("Under review")).toBeInTheDocument();
		expect(screen.getByText("Your loan officer is reviewing your file.")).toBeInTheDocument();
		expect(screen.getByText("Documents requested")).toBeInTheDocument();
		expect(screen.getByText("Requested documents")).toBeInTheDocument();
		expect(screen.getByText("Property appraisal")).toBeInTheDocument();
		expect(screen.queryByText("Next step")).toBeNull();
		expect(screen.queryByText(/waiting on/i)).toBeNull();
		expect(screen.queryByText(/takes it from there/i)).toBeNull();
		expect(screen.queryByText(/all caught up/i)).toBeNull();
		expect(screen.queryByRole("button", { name: /sent everything/i })).toBeNull();
		// The upload stays available: it is how anything still missing gets sent.
		expect(screen.getByRole("button", { name: "Upload documents" })).toBeInTheDocument();
	});
});
