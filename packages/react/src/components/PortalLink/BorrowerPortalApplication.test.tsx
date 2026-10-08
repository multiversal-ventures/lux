/**
 * The applicant's spec-driven application step.
 *
 * Every fixture below is the real DSCR wire shape, copied from what
 * `portal_form` / `PortalProduct.documents_for` actually serialise — labels,
 * hints, units, bounds, options and document copy all as veritas emits them
 * from YAML. Nothing here invents a string the server would not send, because
 * the whole claim under test is that the screen is built from server data.
 *
 * `pending_inputs` and `required_documents` are BOTH resolved server-side
 * against the answers stored so far, so a conditional input and a conditional
 * document row are two-pass phenomena, not client-side interactions: they
 * appear on the session that comes back AFTER `set_inputs`. The tests that
 * cover them therefore rerender with a second fixture rather than clicking and
 * expecting the DOM to grow — clicking could never work against the real wire,
 * and a test written that way would only be satisfiable by inventing
 * client-side conditional logic that contradicts the server.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../hooks/usePortalSession.js", () => ({ usePortalSession: vi.fn() }));

import { usePortalSession } from "../../hooks/usePortalSession.js";
import { BorrowerPortal } from "./BorrowerPortal";

const mockUsePortalSession = usePortalSession as unknown as Mock;

// ─── Wire fixtures: DSCR's five create-time inputs ───────────────────────────

const LOAN_AMOUNT = {
	name: "proposed_loan_amount",
	type: "currency",
	label: "Proposed Loan Amount",
	hint: "The amount you are asking to borrow on this property",
	default: null,
	required: true,
	unit: "usd",
	minimum: 1,
	maximum: 100000000,
	step: null,
	options: [],
	required_when: null,
	decides: false,
};

const ANNUAL_RATE = {
	name: "proposed_annual_rate",
	type: "percentage",
	label: "Proposed Annual Rate",
	hint: "Enter the rate as a percentage (e.g. 6.5 for 6.5%)",
	default: null,
	required: true,
	unit: "percentage",
	minimum: 0.0001,
	maximum: 0.5,
	step: 0.001,
	options: [],
	required_when: null,
	decides: false,
};

/** The ONE field in the catalog that declares an `override.default`. It is here
 * because a default is the thing most likely to be rendered and simultaneously
 * treated as missing. */
const TERM_MONTHS = {
	name: "proposed_term_months",
	type: "integer",
	label: "Proposed Term (months)",
	hint: "Length of the loan in months — 360 is a 30-year term",
	default: 360,
	required: true,
	unit: "months",
	minimum: 12,
	maximum: 480,
	step: null,
	options: [],
	required_when: null,
	decides: false,
};

/** The deciding input. Note `default: null` — the spec's server-side default of
 * `rate_term_refi` lives on the raw input, NOT in the `override:` block that
 * feeds this wire field, so nothing legitimate can pre-select it. */
const TRANSACTION_TYPE = {
	name: "transaction_type",
	type: "string",
	label: "Transaction Type",
	hint: "Loan transaction leg — drives threshold overrides for cash-out vs rate/term vs purchase",
	default: null,
	required: true,
	unit: null,
	minimum: null,
	maximum: null,
	step: null,
	options: [
		{ value: "purchase", label: "Purchase" },
		{ value: "rate_term_refi", label: "Rate / Term Refi" },
		{ value: "cash_out_refi", label: "Cash-Out Refi" },
	],
	required_when: null,
	// Some `required_when` reads this field, so changing it can move both
	// lists — which is exactly when a preview round-trip pays.
	decides: true,
};

/** Advertised ONLY on the pass after `transaction_type: purchase` is stored.
 * Its `required_when` still rides along on the wire and names a field that, by
 * then, is no longer in `pending_inputs` at all. */
const PURCHASE_PRICE = {
	name: "proposed_purchase_price",
	type: "currency",
	label: "Purchase Price",
	hint: "Required for purchase transactions (lower-of rule for LTV)",
	default: null,
	required: true,
	unit: "usd",
	minimum: 0,
	maximum: 100000000,
	step: null,
	options: [],
	required_when: { field: "transaction_type", equals: "purchase" },
	decides: false,
};

// ─── Wire fixtures: the product's document asks ──────────────────────────────

const RENT_NOTE =
	"If the property is vacant you can skip this — but only your appraisal's market rent estimate can stand in for it, and about half of appraisals do not carry one.";

const UNCONDITIONAL_DOCS = [
	{ label: "Proof of rental income", note: RENT_NOTE, optional: true },
	{ label: "AppraisalReport", note: "", optional: false },
	{ label: "PropertyTaxBill", note: "", optional: false },
	{ label: "InsuranceDeclaration", note: "", optional: false },
];

const PURCHASE_DOC = { label: "Purchase or sales agreement", note: "", optional: false };
const REFI_DOC = { label: "Current mortgage statement", note: "", optional: false };

const PRODUCT_LABEL = "DSCR (Investment Property)";

// ─── Session fixtures ────────────────────────────────────────────────────────

function baseSession(overrides: Record<string, unknown> = {}) {
	return {
		session_id: "sess-1",
		case_id: "9f2c1b4e-7c33-4c1a-9a55-0f1d2e3a4b5c",
		case_state: "awaiting_inputs",
		entity: { name: "Jane Borrower" },
		verification: { verified: true, level: 2 },
		has_account: false,
		signed: false,
		submitted: false,
		requires_code: false,
		account_email: null,
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
		inbound_email_address: null,
		pending_inputs: [],
		product_id: null,
		product_display_label: null,
		required_documents: [],
		...overrides,
	};
}

/** Pass one: the four unconditional inputs, the four unconditional documents.
 * `transaction_type` is unanswered, so neither conditional row is resolved —
 * the server fails closed rather than substituting its own default. */
function passOneSession(overrides: Record<string, unknown> = {}) {
	return baseSession({
		pending_inputs: [LOAN_AMOUNT, ANNUAL_RATE, TERM_MONTHS, TRANSACTION_TYPE],
		product_id: "dscr",
		product_display_label: PRODUCT_LABEL,
		required_documents: UNCONDITIONAL_DOCS,
		...overrides,
	});
}

/** Pass two, after `transaction_type: purchase` was stored: the answered field
 * has dropped out of the list, its conditional dependant has appeared, and so
 * has the purchase-only document row. */
function passTwoSession(overrides: Record<string, unknown> = {}) {
	return baseSession({
		pending_inputs: [PURCHASE_PRICE],
		product_id: "dscr",
		product_display_label: PRODUCT_LABEL,
		required_documents: [...UNCONDITIONAL_DOCS, PURCHASE_DOC],
		...overrides,
	});
}

/** Nothing left to answer — the applicant falls through to the account step. */
function answeredSession(overrides: Record<string, unknown> = {}) {
	return baseSession({
		pending_inputs: [],
		product_id: "dscr",
		product_display_label: PRODUCT_LABEL,
		required_documents: UNCONDITIONAL_DOCS,
		...overrides,
	});
}

/** The document hub, past every gate. */
function hubSession(overrides: Record<string, unknown> = {}) {
	return baseSession({
		has_account: true,
		signed: true,
		account_email: "jane@example.com",
		...overrides,
	});
}

function mountWith(
	session: Record<string, unknown>,
	submitIntent: Mock = vi.fn(),
	previewForm?: Mock,
) {
	if (!submitIntent.getMockImplementation() && submitIntent.mock.results.length === 0) {
		submitIntent.mockResolvedValue([]);
	}
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
		previewForm,
	});
	const view = render(<BorrowerPortal token="tok" />);
	return {
		...view,
		submitIntent,
		/** Swap the session the mocked hook serves and re-render, which is how a
		 * second server pass reaches the component. */
		next(nextSession: Record<string, unknown>) {
			mockUsePortalSession.mockReturnValue({
				session: nextSession,
				loading: false,
				error: null,
				uploadError: null,
				clearUploadError: vi.fn(),
				submitIntent,
				uploadDocuments: vi.fn(),
				operatorTyping: false,
				sendTyping: vi.fn(),
				loadMessagesBefore: vi.fn(),
				previewForm,
			});
			view.rerender(<BorrowerPortal token="tok" />);
		},
	};
}

/** Fill the three inputs that are not the deciding one, leaving
 * `transaction_type` untouched. Term is already seeded from YAML. */
async function fillEverythingExceptTransactionType(user: ReturnType<typeof userEvent.setup>) {
	await user.type(screen.getByLabelText("Proposed Loan Amount"), "500000");
	await user.type(screen.getByLabelText("Proposed Annual Rate"), "6.5");
}

/** The stepper's chips, in order, as `"<marker><label>"` — a done step's marker
 * is "✓" and a pending one's is its number. Read off the only `<ol>` on the
 * page, because the document ask list is a `<ul>` of `<li>`s too and a
 * role-based query would sweep those in. */
function stepperChips(): string[] {
	const ol = document.querySelector("ol");
	if (!ol) throw new Error("no stepper rendered");
	return Array.from(ol.querySelectorAll("li")).map((li) => li.textContent ?? "");
}

const DOCUMENT_HEADING = /what you'll need to upload/i;
/** The refusal banner's accessible name, which is how it is told apart from the
 * per-field `role="alert"` messages rendered under each input. */
const REFUSAL_TITLE = /we couldn't save your answers/i;
const ACCOUNT_STEP_COPY = /we'll remember your email so you can pick up where you left off/i;

beforeEach(() => {
	mockUsePortalSession.mockReset();
});

// ─────────────────────────────────────────────────────────────────────────────

describe("application step — the form is built from pending_inputs", () => {
	it("renders every advertised field with the label, hint and unit the server sent", () => {
		mountWith(passOneSession());

		// The heading names the product from `product_display_label`, not from
		// anything this component knows about DSCR.
		expect(screen.getByRole("heading", { name: `Step 2: ${PRODUCT_LABEL}` })).toBeInTheDocument();

		for (const field of [LOAN_AMOUNT, ANNUAL_RATE, TERM_MONTHS, TRANSACTION_TYPE]) {
			expect(screen.getByLabelText(field.label)).toBeInTheDocument();
			expect(screen.getByText(field.hint)).toBeInTheDocument();
		}

		// Units are rendered from the YAML `unit:` slug, via the shared
		// `unitSuffix` map — "percentage" → "%", "months" → "months".
		expect(screen.getByText("%")).toBeInTheDocument();
		expect(screen.getByText("months")).toBeInTheDocument();

		// The one YAML-declared default is both SHOWN and held as a value. Showing
		// it is `resolveEffectiveValue` and would happen without any seeding;
		// holding it is what keeps the validator from calling a visibly-filled
		// field missing, and is asserted by the enabled-submit test below.
		expect(screen.getByLabelText(TERM_MONTHS.label)).toHaveValue(360);
	});

	it("shows no form at all — and moves on — when the server advertises no inputs", () => {
		const { unmount } = mountWith(answeredSession());

		expect(screen.queryByRole("heading", { name: `Step 2: ${PRODUCT_LABEL}` })).toBeNull();
		expect(screen.queryByLabelText(TRANSACTION_TYPE.label)).toBeNull();
		expect(screen.queryByText(DOCUMENT_HEADING)).toBeNull();
		// Where it went instead — so "no form" cannot mean "nothing rendered".
		expect(screen.getByText(ACCOUNT_STEP_COPY)).toBeInTheDocument();

		unmount();

		// POSITIVE CONTROL, same fixture with only `pending_inputs` /
		// `required_documents` restored.
		mountWith(passOneSession());
		expect(screen.getByLabelText(TRANSACTION_TYPE.label)).toBeInTheDocument();
		expect(screen.getByText(DOCUMENT_HEADING)).toBeInTheDocument();
		expect(screen.queryByText(ACCOUNT_STEP_COPY)).toBeNull();
	});
});

describe("the deciding input is an explicit choice", () => {
	it("pre-selects nothing and never offers to auto-detect", async () => {
		const user = userEvent.setup();
		mountWith(passOneSession());

		const select = screen.getByLabelText(TRANSACTION_TYPE.label) as HTMLSelectElement;

		// Nothing chosen. Asserted three ways because each catches a different way
		// of getting this wrong: a client-side default, the shared renderer's
		// `value ?? field.default` fallback, and a stray `selected` attribute.
		expect(select).toHaveValue("");
		expect(select.selectedOptions[0]?.value).toBe("");
		for (const option of TRANSACTION_TYPE.options) {
			const el = within(select).getByRole("option", {
				name: option.label,
			}) as HTMLOptionElement;
			expect(el.selected).toBe(false);
		}

		// The generic renderer's "(auto-detect)" is a promise nothing keeps here:
		// an unanswered deciding input is not inferred, it is REFUSED.
		expect(screen.queryByRole("option", { name: /auto-detect/i })).toBeNull();

		// POSITIVE CONTROL: the select does work — so "nothing selected" above is
		// the absence of a default, not a control that can never hold a value.
		await user.selectOptions(select, "purchase");
		expect(select).toHaveValue("purchase");
		expect(
			(within(select).getByRole("option", { name: "Purchase" }) as HTMLOptionElement).selected,
		).toBe(true);
	});

	it("blocks submit while the deciding input is unanswered, and names it", async () => {
		const user = userEvent.setup();
		const { submitIntent } = mountWith(passOneSession());
		await fillEverythingExceptTransactionType(user);

		const submit = screen.getByRole("button", { name: /continue/i });
		expect(submit).toBeDisabled();
		// The blocker is named — a disabled button with no explanation is the
		// dead end this is meant to avoid. Only the deciding input is listed,
		// which also proves the other three (including the YAML-defaulted term)
		// are held as real values and not merely displayed.
		expect(screen.getByRole("status")).toHaveTextContent(`Still needed: ${TRANSACTION_TYPE.label}`);
		await user.click(submit);
		expect(submitIntent).not.toHaveBeenCalled();

		// POSITIVE CONTROL, same mount, one answer added.
		await user.selectOptions(screen.getByLabelText(TRANSACTION_TYPE.label), "purchase");
		expect(submit).toBeEnabled();
		expect(screen.queryByRole("status")).toBeNull();
		await user.click(submit);
		expect(submitIntent).toHaveBeenCalledTimes(1);
	});
});

describe("submitting the form", () => {
	it("posts a set_inputs intent carrying the fraction, not the displayed percentage", async () => {
		const user = userEvent.setup();
		const { submitIntent } = mountWith(passOneSession());

		await fillEverythingExceptTransactionType(user);
		await user.selectOptions(screen.getByLabelText(TRANSACTION_TYPE.label), "purchase");

		// What the applicant SEES for the rate — 6.5, a percentage — asserted
		// beside what goes on the wire below. The two differing by ×100 is the
		// whole contract: `$.finance.amort` divides the stored value by 12 and a
		// 650% rate is what a re-scale here would produce.
		expect(screen.getByLabelText(ANNUAL_RATE.label)).toHaveValue(6.5);

		await user.click(screen.getByRole("button", { name: /continue/i }));

		expect(submitIntent).toHaveBeenCalledWith([
			{
				type: "set_inputs",
				params: {
					inputs: {
						proposed_loan_amount: 500000,
						proposed_annual_rate: 0.065,
						proposed_term_months: 360,
						transaction_type: "purchase",
					},
				},
			},
		]);
	});
});

describe("required_when — resolved by the server, across two passes", () => {
	it("advertises the conditional field only on the pass after its predicate holds", () => {
		const view = mountWith(passOneSession());

		// Pass one: absent. The four that ARE advertised are asserted in the same
		// breath, so this cannot pass against a form that rendered nothing.
		expect(screen.queryByLabelText(PURCHASE_PRICE.label)).toBeNull();
		for (const field of [LOAN_AMOUNT, ANNUAL_RATE, TERM_MONTHS, TRANSACTION_TYPE]) {
			expect(screen.getByLabelText(field.label)).toBeInTheDocument();
		}

		view.next(passTwoSession());

		// Pass two: present, and the answered field is gone — the server subtracts
		// what it has stored.
		expect(screen.getByLabelText(PURCHASE_PRICE.label)).toBeInTheDocument();
		expect(screen.queryByLabelText(TRANSACTION_TYPE.label)).toBeNull();
	});

	it("treats an advertised conditional field as required even though the field it names is gone", async () => {
		const user = userEvent.setup();
		const { submitIntent } = mountWith(passTwoSession());

		// The wire `required_when` names `transaction_type`, which is no longer in
		// `pending_inputs` and therefore not in the form's state at all. Evaluating
		// that predicate client-side yields `undefined === "purchase"` → "not
		// required", and a purchase would be submittable with no price. The server
		// already resolved it; the adapter drops it for exactly this reason.
		const submit = screen.getByRole("button", { name: /continue/i });
		expect(submit).toBeDisabled();
		expect(screen.getByRole("status")).toHaveTextContent(`Still needed: ${PURCHASE_PRICE.label}`);
		await user.click(submit);
		expect(submitIntent).not.toHaveBeenCalled();

		// POSITIVE CONTROL: supplying it unblocks the same button.
		await user.type(screen.getByLabelText(PURCHASE_PRICE.label), "650000");
		expect(submit).toBeEnabled();
	});
});

describe("the stepper", () => {
	it("keeps the Application chip once the form has been shown, so later steps do not renumber", () => {
		const view = mountWith(passOneSession());

		expect(stepperChips()).toEqual(["✓Verify", "2Application", "3Account", "4Consent"]);
		// Consent is step 4 while the form exists — the number is derived from the
		// assembled flow, not hardcoded on the step component.
		expect(screen.getByRole("heading", { name: `Step 2: ${PRODUCT_LABEL}` })).toBeInTheDocument();

		// Answering empties `pending_inputs`, so the stage that owns the chip is
		// gone. The chip must not be: dropping it here would slide Account from 3
		// to 2 and Consent from 4 to 3 under the applicant mid-flow.
		view.next(answeredSession());

		expect(stepperChips()).toEqual(["✓Verify", "✓Application", "3Account", "4Consent"]);
		expect(screen.getByRole("heading", { name: /^Step 3: / })).toBeInTheDocument();
	});

	it("never offers the chip to an applicant whose case asks for nothing", () => {
		mountWith(answeredSession());

		// POSITIVE CONTROL for the assertion above: the chip is not unconditional.
		// A case that never had a form to show gets the original three-step flow.
		expect(stepperChips()).toEqual(["✓Verify", "2Account", "3Consent"]);
	});
});

describe("the product's document asks", () => {
	it("renders each row with the label and note the product declares", () => {
		mountWith(passOneSession());

		expect(screen.getByText(DOCUMENT_HEADING)).toBeInTheDocument();
		for (const doc of UNCONDITIONAL_DOCS) {
			expect(screen.getByText(doc.label)).toBeInTheDocument();
		}
		// The note is borrower-facing copy authored in `loan_products.yaml`, and
		// it is rendered verbatim rather than summarised.
		expect(screen.getByText(RENT_NOTE)).toBeInTheDocument();
		// An `any_of` group is ONE row and is the only optional ask, so exactly one
		// "Optional" marker should exist — not one per underlying document type.
		expect(screen.getAllByText("Optional")).toHaveLength(1);
	});

	it("shows neither conditional row until a transaction type is chosen, then the right one", () => {
		const view = mountWith(passOneSession());

		// Fails closed: an unanswered `transaction_type` resolves NEITHER row. The
		// four unconditional rows are asserted alongside so this is a statement
		// about the two conditional ones, not about an empty section.
		expect(screen.queryByText(PURCHASE_DOC.label)).toBeNull();
		expect(screen.queryByText(REFI_DOC.label)).toBeNull();
		for (const doc of UNCONDITIONAL_DOCS) {
			expect(screen.getByText(doc.label)).toBeInTheDocument();
		}

		view.next(passTwoSession());

		// Purchase chosen → the purchase agreement is asked for and the mortgage
		// statement still is not. Getting this backwards is the concrete harm the
		// deciding-input rules exist to prevent.
		expect(screen.getByText(PURCHASE_DOC.label)).toBeInTheDocument();
		expect(screen.queryByText(REFI_DOC.label)).toBeNull();
	});

	it("asks for the refi document instead when the answer was a refinance", () => {
		mountWith(
			passTwoSession({
				pending_inputs: [LOAN_AMOUNT],
				required_documents: [...UNCONDITIONAL_DOCS, REFI_DOC],
			}),
		);

		expect(screen.getByText(REFI_DOC.label)).toBeInTheDocument();
		expect(screen.queryByText(PURCHASE_DOC.label)).toBeNull();
	});
});

describe("a server refusal", () => {
	/** The wire shape of `handle_set_inputs`'s discriminator guard: HTTP 200,
	 * `error: null`, an unchanged session — the refusal exists ONLY in the
	 * per-intent results. A client that reads `res.ok` sees a success. */
	function refusalWith(detail: string) {
		return vi
			.fn()
			.mockResolvedValue([{ intent: "set_inputs", status: "error", detail, consent_id: null }]);
	}

	it("shows what to fix, against the field, using the field's own label", async () => {
		const user = userEvent.setup();
		const submitIntent = refusalWith(
			"transaction_type: choose a value — this one decides what else we ask for, so we will not pick it for you",
		);
		mountWith(passOneSession(), submitIntent);

		await fillEverythingExceptTransactionType(user);
		await user.selectOptions(screen.getByLabelText(TRANSACTION_TYPE.label), "purchase");
		await user.click(screen.getByRole("button", { name: /continue/i }));

		// The applicant reads the field's YAML label, never the machine name the
		// server prefixed the line with.
		const banner = await screen.findByRole("alert", { name: REFUSAL_TITLE });
		expect(banner).toHaveTextContent(
			`${TRANSACTION_TYPE.label}: choose a value — this one decides what else we ask for, so we will not pick it for you`,
		);
		expect(banner).not.toHaveTextContent("transaction_type:");

		// And beside the control itself, so the fix is where the fixing happens:
		// a second `role="alert"`, emitted by `renderSchemaField` under the input.
		const inline = screen
			.getAllByRole("alert")
			.filter((el) => el !== banner)
			.map((el) => el.textContent);
		expect(inline).toEqual([
			"choose a value — this one decides what else we ask for, so we will not pick it for you",
		]);

		// The form is still there to fix — the refusal is not a dead end, and the
		// server left the case untouched so there is nothing to undo.
		expect(screen.getByLabelText(TRANSACTION_TYPE.label)).toHaveValue("purchase");
		expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
	});

	it("splits a multi-error refusal per field and keeps anything it cannot attribute", async () => {
		const user = userEvent.setup();
		const submitIntent = refusalWith(
			"proposed_loan_amount: must be at least 1; This application isn't scoped to a single product.",
		);
		mountWith(passOneSession(), submitIntent);

		await fillEverythingExceptTransactionType(user);
		await user.selectOptions(screen.getByLabelText(TRANSACTION_TYPE.label), "purchase");
		await user.click(screen.getByRole("button", { name: /continue/i }));

		const banner = await screen.findByRole("alert", { name: REFUSAL_TITLE });
		expect(banner).toHaveTextContent(`${LOAN_AMOUNT.label}: must be at least 1`);
		// A line naming no advertised field survives verbatim rather than being
		// swallowed by the parser — the next server-side check to be added must
		// still reach the applicant.
		expect(banner).toHaveTextContent("This application isn't scoped to a single product.");
	});

	it("shows nothing when every intent succeeded", async () => {
		const user = userEvent.setup();
		const submitIntent = vi
			.fn()
			.mockResolvedValue([{ intent: "set_inputs", status: "ok", detail: "" }]);
		mountWith(passOneSession(), submitIntent);

		await fillEverythingExceptTransactionType(user);
		await user.selectOptions(screen.getByLabelText(TRANSACTION_TYPE.label), "purchase");
		await user.click(screen.getByRole("button", { name: /continue/i }));

		await waitFor(() => expect(submitIntent).toHaveBeenCalledTimes(1));
		expect(screen.queryByRole("alert")).toBeNull();
	});
});

describe("an input type this build does not recognise", () => {
	const UNKNOWN_FIELD = {
		...LOAN_AMOUNT,
		name: "borrower_vibe",
		type: "quantum_flux",
		label: "Borrower Vibe",
		hint: "Something a future spec declared",
		unit: null,
		minimum: null,
		maximum: null,
	};

	let warn: ReturnType<typeof vi.spyOn>;
	beforeEach(() => {
		warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	});
	afterEach(() => {
		warn.mockRestore();
	});

	it("still renders and submits the field rather than dropping or crashing on it", async () => {
		const user = userEvent.setup();
		const { submitIntent } = mountWith(passOneSession({ pending_inputs: [UNKNOWN_FIELD] }));

		// Present, labelled, and answerable. `type` is a bare string on the wire —
		// veritas publishes no enum — so the renderer switch gets no
		// exhaustiveness check and this is the branch that catches what falls off
		// the end of it.
		const input = screen.getByLabelText(UNKNOWN_FIELD.label);
		expect(input).toBeInTheDocument();
		expect(screen.getByText(UNKNOWN_FIELD.hint)).toBeInTheDocument();
		await user.type(input, "electric");
		expect(input).toHaveValue("electric");

		// And it reaches the server, which re-validates it against the same schema.
		await user.click(screen.getByRole("button", { name: /continue/i }));
		expect(submitIntent).toHaveBeenCalledWith([
			{ type: "set_inputs", params: { inputs: { borrower_vibe: "electric" } } },
		]);

		// Reported, so a spec typo is distinguishable from a deliberate string.
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("quantum_flux"));
	});
});

describe("the checklist on the document hub", () => {
	const ITEM = {
		title: "Upload your appraisal report",
		detail: "We need the full PDF.",
		status: "pending",
		priority: "high",
		action: null,
	};

	it("renders the outstanding request, and nothing at all when there is none", () => {
		const { unmount } = mountWith(hubSession({ checklist: [] }));

		// The hub really did render — the assertion below is about the checklist,
		// not about a screen that never mounted.
		expect(screen.getByLabelText("Attach documents")).toBeInTheDocument();
		// `Checklist`'s empty state is a full "You're all caught up" card; dropped
		// into a chat transcript it reads as the page having broken.
		expect(screen.queryByText(/you're all caught up/i)).toBeNull();

		unmount();

		// POSITIVE CONTROL: same hub, one checklist item.
		mountWith(hubSession({ checklist: [ITEM] }));
		expect(screen.getByText(ITEM.title)).toBeInTheDocument();
		expect(screen.getByText(ITEM.detail)).toBeInTheDocument();
		expect(screen.getByLabelText("Attach documents")).toBeInTheDocument();
	});

	it("keeps the ask list off the hub — the checklist is what is outstanding there", () => {
		mountWith(hubSession({ required_documents: UNCONDITIONAL_DOCS, checklist: [ITEM] }));

		// `required_documents` is the product's declaration; `checklist` is the
		// request actually outstanding against this party, and once a loan officer
		// hand-authors one the two legitimately disagree. Rendering both here
		// would show contradictory asks.
		expect(screen.queryByText(DOCUMENT_HEADING)).toBeNull();
		expect(screen.getByText(ITEM.title)).toBeInTheDocument();
	});
});

/**
 * The portal's FIRST render is always `loading` — the session has not arrived.
 * Every other test in this file mounts with `loading: false`, so none of them
 * ever crosses that boundary, and a hook declared below the `loading` early
 * return therefore stayed invisible to 345 passing tests while blanking the
 * real page with React error #310 ("rendered more hooks than during the
 * previous render").
 *
 * This renders the transition the browser actually performs. It asserts on the
 * loaded output rather than on the absence of an error, because React logs #310
 * and unmounts — a test that only checked for a thrown value would pass while
 * the applicant saw nothing.
 */
it("survives the loading -> loaded transition every real visit begins with", async () => {
	const submitIntent = vi.fn().mockResolvedValue([]);
	const hookState = (over: Record<string, unknown>) => ({
		session: null,
		loading: true,
		error: null,
		uploadError: null,
		clearUploadError: vi.fn(),
		submitIntent,
		uploadDocuments: vi.fn(),
		operatorTyping: false,
		sendTyping: vi.fn(),
		loadMessagesBefore: vi.fn(),
		...over,
	});

	mockUsePortalSession.mockReturnValue(hookState({}));
	const view = render(<BorrowerPortal token="tok" />);
	expect(screen.getByText(/loading/i)).toBeInTheDocument();

	// The session arrives — the same component instance, one render later.
	mockUsePortalSession.mockReturnValue(
		hookState({ session: passOneSession(), loading: false }),
	);
	view.rerender(<BorrowerPortal token="tok" />);

	// Positive control: the application step actually rendered. Without it this
	// test would pass against a component that renders nothing at all.
	expect(await screen.findByLabelText(/proposed loan amount/i)).toBeInTheDocument();
});

// ─── One pass: the server previews the form while it is being filled in ─────

/** What `POST /portal/session/{id}/form-preview` answers once
 * `transaction_type: purchase` is in the DRAFT but not yet saved: the deciding
 * field STAYS (its answer is unsaved, so it is still pending) and its
 * conditional dependant and document row have appeared. */
function purchasePreview() {
	return {
		pending_inputs: [LOAN_AMOUNT, ANNUAL_RATE, TERM_MONTHS, TRANSACTION_TYPE, PURCHASE_PRICE],
		required_documents: [...UNCONDITIONAL_DOCS, PURCHASE_DOC],
	};
}

describe("one pass — the server resolves the form as it is filled in", () => {
	it("previews when a decides field changes", async () => {
		const user = userEvent.setup();
		const previewForm = vi.fn().mockResolvedValue(purchasePreview());
		mountWith(passOneSession(), vi.fn(), previewForm);

		await user.selectOptions(screen.getByLabelText(TRANSACTION_TYPE.label), "purchase");

		await waitFor(() => expect(previewForm).toHaveBeenCalledTimes(1));
		// The draft it sends is the answers so far — including the one just made.
		expect(previewForm.mock.calls[0][0]).toMatchObject({
			transaction_type: "purchase",
			proposed_term_months: 360,
		});
	});

	it("does not preview when a non-decides field changes", async () => {
		const user = userEvent.setup();
		const previewForm = vi.fn().mockResolvedValue(purchasePreview());
		mountWith(passOneSession(), vi.fn(), previewForm);

		await user.type(screen.getByLabelText(LOAN_AMOUNT.label), "500000");
		// Longer than the debounce: a round trip would have fired by now.
		await new Promise((resolve) => setTimeout(resolve, 400));

		expect(previewForm).not.toHaveBeenCalled();
	});

	it("replaces the fields and documents with the preview's", async () => {
		const user = userEvent.setup();
		const previewForm = vi.fn().mockResolvedValue(purchasePreview());
		mountWith(passOneSession(), vi.fn(), previewForm);

		expect(screen.queryByLabelText(PURCHASE_PRICE.label)).not.toBeInTheDocument();
		expect(screen.queryByText(PURCHASE_DOC.label)).not.toBeInTheDocument();

		await user.selectOptions(screen.getByLabelText(TRANSACTION_TYPE.label), "purchase");

		// No second session, no rerender: the server answered the preview.
		expect(await screen.findByLabelText(PURCHASE_PRICE.label)).toBeInTheDocument();
		expect(screen.getByText(PURCHASE_DOC.label)).toBeInTheDocument();
	});

	it("keeps the values already typed when the field list is replaced", async () => {
		const user = userEvent.setup();
		const previewForm = vi.fn().mockResolvedValue(purchasePreview());
		mountWith(passOneSession(), vi.fn(), previewForm);

		await fillEverythingExceptTransactionType(user);
		await user.selectOptions(screen.getByLabelText(TRANSACTION_TYPE.label), "purchase");
		await screen.findByLabelText(PURCHASE_PRICE.label);

		// The currency renderer re-formats from the stored number, which is the
		// proof the value survived the list being replaced under it.
		expect(screen.getByLabelText(LOAN_AMOUNT.label)).toHaveValue("$500,000.00");
		expect(screen.getByLabelText(ANNUAL_RATE.label)).toHaveValue(6.5);
		expect(screen.getByLabelText(TRANSACTION_TYPE.label)).toHaveValue("purchase");
	});

	it("submits every answer in one set_inputs", async () => {
		const user = userEvent.setup();
		const submitIntent = vi.fn().mockResolvedValue([]);
		const previewForm = vi.fn().mockResolvedValue(purchasePreview());
		mountWith(passOneSession(), submitIntent, previewForm);

		await fillEverythingExceptTransactionType(user);
		await user.selectOptions(screen.getByLabelText(TRANSACTION_TYPE.label), "purchase");
		await user.type(await screen.findByLabelText(PURCHASE_PRICE.label), "650000");
		await user.click(screen.getByRole("button", { name: /continue/i }));

		expect(submitIntent).toHaveBeenCalledTimes(1);
		expect(submitIntent.mock.calls[0][0]).toEqual([
			{
				type: "set_inputs",
				params: {
					inputs: {
						proposed_loan_amount: 500000,
						proposed_annual_rate: 0.065,
						proposed_term_months: 360,
						transaction_type: "purchase",
						proposed_purchase_price: 650000,
					},
				},
			},
		]);
	});
});
