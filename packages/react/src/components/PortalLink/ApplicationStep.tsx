/**
 * `<ApplicationStep>` — the applicant's own copy of their product's form.
 *
 * Everything on this screen is authored in Veritas YAML and arrives on the
 * portal session. Nothing here knows what a product is:
 *
 * ```
 * spec `inputs[*].override:`        →  PortalSessionResponse.pending_inputs
 * loan_products.yaml
 *   `required_documents:`           →  PortalSessionResponse.required_documents
 * display_labels.yaml               →  PortalSessionResponse.product_display_label
 * ```
 *
 * The renderers are the SAME ones the operator's create-case modal uses
 * (`DynamicUserInputsFormFields` → `renderSchemaField` → `fieldRenderers`), so
 * the fraction↔percentage contract — a `percentage` field stores `0.065` and
 * displays `6.5` — holds identically on both surfaces. There is one deliberate
 * substitution, {@link PortalSelectField}; see its docstring.
 *
 * ## Two passes, not one form
 *
 * `pending_inputs` is resolved server-side against the answers stored so far:
 * a conditional field is advertised only once its `required_when` predicate
 * already holds, and an answered field drops out. So answering
 * `transaction_type: purchase` makes `proposed_purchase_price` appear on the
 * NEXT session, and the same round-trip is what makes the purchase agreement
 * appear in `required_documents`. This component therefore never evaluates a
 * predicate itself — it renders the list it was handed, submits, and renders
 * whatever list comes back.
 *
 * ## `required_documents` is the ASK, `checklist` is PROGRESS
 *
 * Only the ask list belongs here. The two agree right after `set_inputs` and
 * diverge the moment a loan officer sends a hand-authored request, at which
 * point `checklist` is what the applicant is actually being asked for. Showing
 * both side by side would present contradictory asks, so the checklist is
 * rendered on the document hub instead.
 */

import type {
	IntentResult,
	PortalDocumentRequirement,
	PortalInputField,
	components,
} from "@multiversal-ventures/lux-core";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
	DynamicUserInputsFormFields,
	validateInitialRequiredInputs,
} from "../Refinement/DynamicUserInputsForm.js";
import type {
	DynamicUserInputFieldRenderer,
	DynamicUserInputFieldRendererProps,
} from "../Refinement/DynamicUserInputsForm.js";
import { StringField, pickDefaultRenderer } from "../Refinement/fieldRenderers.js";

type UserInputField = components["schemas"]["UserInputFieldResponse"];

/**
 * Placeholder for an unanswered choice.
 *
 * Deliberately NOT the generic renderer's `"(auto-detect)"`
 * (`Refinement/fieldRenderers.tsx`), which is a promise this surface cannot
 * keep. Nothing auto-detects an applicant's answer: an unanswered input is
 * either defaulted by the engine to a value nobody chose, or — for an input the
 * product's own declarations mark as DECIDING — refused outright by
 * `set_inputs`. Telling a stranger the system will work it out invites them to
 * leave it alone, which is the one thing that cannot happen.
 */
const CHOOSE_PLACEHOLDER = "Select an option…";

/** Ties the refusal banner to its own heading so it has an accessible name. */
const REFUSAL_TITLE_ID = "portal-application-refusal";

/**
 * Input types this surface knows how to render, as declared by
 * `UserInputFieldSchema.type`'s docstring in `policy/user_inputs_schema.py`,
 * plus the aliases `pickDefaultRenderer` already accepts.
 *
 * The wire type is a bare `string` — veritas declares no `Literal`, so no enum
 * reaches OpenAPI and TypeScript gives this switch no exhaustiveness check.
 * Hence an explicit set rather than a `default:` arm that quietly absorbs
 * anything: see {@link portalFieldRenderer} for what an unrecognised type does.
 */
const KNOWN_INPUT_TYPES: ReadonlySet<string> = new Set([
	"boolean",
	"currency",
	"enum",
	"integer",
	"number",
	"percent",
	"percentage",
	"string",
	"year",
]);

// ─── The adapter ─────────────────────────────────────────────────────────────

/**
 * `PortalInputField` → the operator-shaped `UserInputFieldResponse` the shared
 * renderers are typed against.
 *
 * The borrower type is not a subset that can be cast: it is missing three
 * required members and types `required_when` differently. Each substitution is
 * a decision, not a shim:
 *
 * - **`required_when: null`.** The server advertises a conditional field ONLY
 *   once its predicate holds, so every field in `pending_inputs` is required
 *   right now. Passing the predicate through would be actively wrong: the field
 *   it names (`transaction_type`) has already been answered and is therefore
 *   absent from both `pending_inputs` and this form's state, so
 *   `validateInitialRequiredInputs`'s conditional branch would compare
 *   `undefined` against `"purchase"`, conclude "not required", and let the
 *   applicant submit a purchase with no price.
 * - **`required_at_create: field.required`.** There is no create-time/later
 *   distinction on this surface. Mirroring it keeps the validator correct
 *   whichever way `requiredAtCreateOnly` is set.
 * - **`derive_options_from: null`.** Only `case.document_years` is meaningful,
 *   and an applicant has no document-year picker.
 * - **`spec_name: ""`.** Operator diagnostics; the borrower type withholds it
 *   on purpose and nothing on this surface reads it.
 */
export function toUserInputField(field: PortalInputField): UserInputField {
	return {
		name: field.name,
		type: field.type,
		label: field.label,
		hint: field.hint ?? null,
		default: field.default ?? null,
		required: field.required,
		required_at_create: field.required,
		required_when: null,
		minimum: field.minimum ?? null,
		maximum: field.maximum ?? null,
		step: field.step ?? null,
		unit: field.unit ?? null,
		options: field.options ?? [],
		derive_options_from: null,
		spec_name: "",
	};
}

// ─── Renderers ───────────────────────────────────────────────────────────────

/**
 * Select with NO pre-selected option and no auto-detect promise.
 *
 * Two differences from the shared `SelectField`, both load-bearing on a public
 * link:
 *
 *  1. The empty option reads {@link CHOOSE_PLACEHOLDER}, not `"(auto-detect)"`.
 *  2. The current value is `value` alone — never `value ?? field.default`. A
 *     YAML-declared default is seeded into form state once, on mount, where the
 *     applicant can see and change it; resolving it again at render time would
 *     make a cleared select silently snap back to a value they just rejected.
 *
 * This is what keeps a deciding input an explicit choice. DSCR's
 * `transaction_type` declares no `override.default`, so the wire `default` is
 * `null`, nothing is seeded, and the placeholder is what stands selected until
 * the applicant picks — at which point the thresholds AND the document list
 * follow from what they actually said.
 */
export function PortalSelectField({
	field,
	value,
	disabled,
	classNames,
	onChange,
}: DynamicUserInputFieldRendererProps): ReactNode {
	const options = field.options ?? [];
	return (
		<select
			value={value == null ? "" : String(value)}
			disabled={disabled}
			onChange={(e) => {
				const raw = e.target.value;
				const opt = options.find((o) => String(o.value) === raw);
				onChange(opt ? opt.value : raw === "" ? null : raw);
			}}
			className={classNames?.select}
			aria-label={field.label}
		>
			<option value="">{CHOOSE_PLACEHOLDER}</option>
			{options.map((o) => (
				<option key={String(o.value)} value={String(o.value)}>
					{o.label}
				</option>
			))}
		</select>
	);
}

/**
 * An input whose `type` this build does not recognise.
 *
 * Degraded to free text and reported, never dropped and never thrown on. The
 * three alternatives are all worse: crashing takes the whole application form
 * down for one unknown string; skipping the field leaves the applicant staring
 * at a submit button the server will refuse, with nothing on screen to fix; and
 * a silent `default:` arm makes a genuine typo in a spec indistinguishable from
 * a deliberate `string`.
 *
 * A free-text answer is safe to offer because the server re-validates against
 * the same schema — bounds, options and scalar-ness — so a wrong shape comes
 * back as a field error rather than being stored.
 */
export function UnrecognizedTypeField(props: DynamicUserInputFieldRendererProps): ReactNode {
	console.warn(
		`[lux] portal input "${props.field.name}" declares unrecognised type "${props.field.type}" — rendering it as free text.`,
	);
	return StringField(props);
}

/**
 * Renderer dispatch for the applicant's form.
 *
 * Passed as `slots.defaultRenderer`, which `renderSchemaField` consults BEFORE
 * `pickDefaultRenderer` — the only hook that can reach an options-bearing
 * field, since `slots.renderers` is keyed by `field.type` and DSCR's
 * `transaction_type` arrives as `type: "string"` (its options live in the
 * `override:` block, not in the type).
 */
export function portalFieldRenderer(field: UserInputField): DynamicUserInputFieldRenderer {
	if (field.options && field.options.length > 0) return PortalSelectField;
	if (KNOWN_INPUT_TYPES.has(field.type)) return pickDefaultRenderer(field);
	return UnrecognizedTypeField;
}

// ─── Server refusals ─────────────────────────────────────────────────────────

/**
 * Split a `set_inputs` refusal into per-field messages plus anything left over.
 *
 * The server joins its errors with `"; "` and prefixes each with the input
 * NAME it concerns (`"transaction_type: choose a value — …"`). Names are
 * machine identifiers, so they are swapped for the field's own YAML label
 * before anyone reads them, and each message is attached to the field it names
 * so the fix is beside the control rather than in a banner far from it.
 *
 * Defensive by construction: a message whose prefix matches no advertised field
 * — a future server-side check, or a refusal that names no field at all — falls
 * through to `banner` verbatim rather than being dropped.
 */
export function splitRefusal(
	detail: string,
	fields: readonly PortalInputField[],
): { fieldErrors: Record<string, string>; banner: string[] } {
	const labels = new Map(fields.map((f) => [f.name, f.label]));
	const fieldErrors: Record<string, string> = {};
	const banner: string[] = [];
	for (const part of detail.split("; ")) {
		const trimmed = part.trim();
		if (!trimmed) continue;
		const at = trimmed.indexOf(": ");
		const name = at > 0 ? trimmed.slice(0, at) : "";
		const label = labels.get(name);
		if (label) {
			const message = trimmed.slice(at + 2);
			fieldErrors[name] = message;
			banner.push(`${label}: ${message}`);
		} else {
			banner.push(trimmed);
		}
	}
	return { fieldErrors, banner };
}

// ─── Documents ───────────────────────────────────────────────────────────────

/**
 * The product's document asks. Every string rendered here (`label`, `note`) is
 * authored in `policy/specs/loan_products.yaml` — this component contributes
 * the heading and the "Optional" marker and not one word more.
 *
 * The list is resolved against the answers stored so far and FAILS CLOSED: a
 * row whose `required_when` reads an unanswered input is omitted, so an
 * applicant who has not yet chosen a transaction type is shown neither the
 * purchase agreement nor the mortgage statement. That is transient by design —
 * `set_inputs` refuses to leave them in it.
 */
function DocumentAsks({ documents }: { documents: readonly PortalDocumentRequirement[] }) {
	if (documents.length === 0) return null;
	return (
		<section className="bg-white border border-slate-200 rounded-xl p-6">
			<h3 className="font-semibold text-slate-800 mb-1">What you'll need to upload</h3>
			<p className="text-xs text-slate-500 mb-3">
				You'll be able to send these on the next screen — nothing to attach yet.
			</p>
			<ul className="space-y-3">
				{documents.map((doc) => (
					<li key={doc.label} className="flex gap-2 text-sm">
						<span aria-hidden="true" className="text-slate-300 mt-0.5">
							•
						</span>
						<div>
							<span className="text-slate-800">{doc.label}</span>
							{doc.optional && (
								<span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
									Optional
								</span>
							)}
							{doc.note && <p className="text-xs text-slate-500 mt-0.5">{doc.note}</p>}
						</div>
					</li>
				))}
			</ul>
		</section>
	);
}

// ─── ApplicationStep ─────────────────────────────────────────────────────────

export interface ApplicationStepProps {
	/** `session.pending_inputs` — the fields still to answer, in server order. */
	fields: readonly PortalInputField[];
	/** `session.required_documents` — the product's ask list, resolved so far. */
	documents: readonly PortalDocumentRequirement[];
	/** `session.product_display_label`; `null` when the case names no single
	 * product, in which case `fields` is empty too and this never renders. */
	productLabel: string | null | undefined;
	/** Step number in the flow, for the heading. */
	stepNumber: number;
	/** Submit the answers as a `set_inputs` intent and hand back the per-intent
	 * results — the ONLY place a refusal is observable (it arrives 200, with the
	 * session unchanged). */
	onSubmitInputs: (inputs: Record<string, unknown>) => Promise<IntentResult[]>;
}

export function ApplicationStep({
	fields,
	documents,
	productLabel,
	stepNumber,
	onSubmitInputs,
}: ApplicationStepProps) {
	const adapted = useMemo(() => fields.map(toUserInputField), [fields]);
	const [values, setValues] = useState<Record<string, unknown>>({});
	const [touched, setTouched] = useState<Record<string, boolean>>({});
	const [submitting, setSubmitting] = useState(false);
	const [refusal, setRefusal] = useState<string | null>(null);

	// Seed YAML-declared defaults for every newly-advertised field. Without this
	// a field with a visible default (DSCR's 360-month term) reads as filled in
	// while the validator treats it as missing — a populated control beside a
	// "required" error, with nothing the applicant can do to clear it.
	//
	// This is the ONLY place a value the applicant did not type enters the form,
	// and it can only ever come from the product's own `override.default`. A
	// deciding input that declares none — `transaction_type` — stays empty here,
	// which is the whole point.
	useEffect(() => {
		setValues((prev) => {
			const next = { ...prev };
			let changed = false;
			for (const field of fields) {
				if (next[field.name] === undefined && field.default != null) {
					next[field.name] = field.default;
					changed = true;
				}
			}
			return changed ? next : prev;
		});
	}, [fields]);

	// Client-side mirror of the server's own bounds. `requiredAtCreateOnly:
	// false` reads `field.required`, which `portal_form` sets on EVERY field it
	// advertises — presence in this list IS the requirement.
	const clientErrors = validateInitialRequiredInputs(adapted, values, {
		requiredAtCreateOnly: false,
	});
	const missing = adapted.filter((f) => clientErrors[f.name]);
	const canSubmit = missing.length === 0;

	const refusalParts = refusal ? splitRefusal(refusal, fields) : null;

	// Client errors only after the applicant has touched the control — a form
	// that opens covered in red says nothing useful. A server refusal shows
	// immediately: they already submitted.
	const shownErrors: Record<string, string | undefined> = {};
	for (const [name, message] of Object.entries(clientErrors)) {
		if (touched[name]) shownErrors[name] = message;
	}
	for (const [name, message] of Object.entries(refusalParts?.fieldErrors ?? {})) {
		shownErrors[name] = message;
	}

	async function submit() {
		// Only what the applicant actually answered, keyed by the names the
		// server advertised — an unknown key is a validation error there. Values
		// pass through UNSCALED: `NumericField` already stores a `percentage` as
		// the fraction the engine reads (6.5 typed → 0.065 stored), and touching
		// it here is how a rate becomes 650%.
		const inputs: Record<string, unknown> = {};
		for (const field of fields) {
			const value = values[field.name];
			if (value === undefined || value === null || value === "") continue;
			inputs[field.name] = value;
		}
		setSubmitting(true);
		setRefusal(null);
		const results = await onSubmitInputs(inputs);
		setSubmitting(false);
		const refused = results.find((r) => r.intent === "set_inputs" && r.status !== "ok");
		if (refused) {
			setRefusal(
				refused.detail || "We couldn't save your answers. Please check them and try again.",
			);
		}
	}

	return (
		<section>
			<h2 className="font-semibold text-slate-800 mb-3">
				Step {stepNumber}: {productLabel || "Your application"}
			</h2>
			<div className="space-y-4">
				<div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
					<p className="text-sm text-slate-600">
						A few details about the loan you're applying for. Your loan officer sees these as soon
						as you send them.
					</p>
					<DynamicUserInputsFormFields
						fields={adapted}
						value={values}
						errors={shownErrors}
						onChange={(key, value) => {
							setValues((prev) => ({ ...prev, [key]: value }));
							setTouched((prev) => ({ ...prev, [key]: true }));
						}}
						slots={{ defaultRenderer: (props) => portalFieldRenderer(props.field)(props) }}
						classNames={{
							root: "space-y-4",
							field: {
								root: "space-y-1",
								label: "block text-sm font-medium text-slate-700",
								hint: "text-xs text-slate-500",
								input: "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm",
								select: "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm",
								error: "text-sm text-red-600",
							},
						}}
					/>
					{refusalParts && refusalParts.banner.length > 0 && (
						// Named via `aria-labelledby` because the per-field errors
						// `renderSchemaField` emits are also `role="alert"` — without a
						// name this banner is indistinguishable from them to assistive
						// tech and to anything querying by role.
						<div
							role="alert"
							aria-labelledby={REFUSAL_TITLE_ID}
							className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 space-y-1"
						>
							<p id={REFUSAL_TITLE_ID} className="text-xs font-medium text-red-800">
								We couldn't save your answers
							</p>
							{refusalParts.banner.map((line) => (
								<p key={line} className="text-xs text-red-700">
									{line}
								</p>
							))}
						</div>
					)}
					<button
						type="button"
						onClick={submit}
						disabled={submitting || !canSubmit}
						className="w-full rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-3"
					>
						{submitting ? "Saving…" : "Continue"}
					</button>
					{!canSubmit && (
						// `<output>` carries role="status" implicitly, so this is announced
						// as it changes without an explicit role attribute.
						<output className="block text-xs text-slate-500">
							Still needed: {missing.map((f) => f.label).join(", ")}
						</output>
					)}
				</div>
				<DocumentAsks documents={documents} />
			</div>
		</section>
	);
}
