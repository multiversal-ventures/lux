import type {
	LoanDecisionInfo,
	LoanStatusInfo,
	LoanSummaryField,
	LoanSummaryInfo,
} from "@multiversal-ventures/lux-core";
import { LoanActionPill, LoanStatusBadge, loanToneClasses } from "./LoanStatusBadge.js";

export interface LoanStatusCardProps {
	status: LoanStatusInfo;
	/** The case's subject and the product's own summary rows. `property_label`
	 * is the primary SUBJECT, not always an address, and is null until
	 * something has been extracted — which is why `product_label` titles the
	 * card in its place. */
	summary?: LoanSummaryInfo | null;
	/** Null until an officer publishes a decision to this party. */
	decision?: LoanDecisionInfo | null;
	className?: string;
}

/** The loan officer's own label vocabulary (`LoanDecisionPanel`, `CasesTable`):
 * a small uppercase slate label over the value it names. */
const LABEL = "text-xs font-medium text-slate-500 uppercase tracking-wider";

/** The pill shape used across the operator surfaces (`CasesTable`,
 * `LoanStatusBadge`). Shape only — every tone COLOUR still comes from
 * {@link loanToneClasses}, which stays the single tone → classes map. */
const PILL = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium";

/**
 * What one borrower is told about one loan — the hero of their loan screen.
 *
 * Nothing here is behind a disclosure. The borrower came to read this card, so
 * the status, the plain-language description and the terms of any published
 * decision are all on screen at once: it used to collapse to a badge plus a
 * "View details" button, which hid the one sentence that actually explains
 * what is happening.
 *
 * Every string the borrower reads is server data: the status label, tone and
 * description come from `borrower_statuses.yaml`, the summary rows from the
 * product's `borrower_view.summary`, and the decision's terms from the stored
 * `case_decisions` snapshot. Nothing here is recomputed or re-labelled, and no
 * term value is rendered without a decision to carry it.
 */
export function LoanStatusCard({ status, summary, decision, className }: LoanStatusCardProps) {
	const subject = summary?.property_label || summary?.product_label || null;
	// The product line is a SUBTITLE only when the subject above it is something
	// else; when the product's own name is the title, repeating it is noise.
	// `property_label` is nullable and can be a person's name, so the pair is
	// tested rather than assumed.
	const productSubtitle =
		summary?.property_label && summary?.product_label ? summary.product_label : null;

	return (
		<section
			className={`bg-white rounded-lg border border-slate-200 shadow-sm p-5 sm:p-6${className ? ` ${className}` : ""}`}
		>
			{subject ? (
				<h2 className="text-lg font-semibold text-slate-900 break-words">{subject}</h2>
			) : null}
			{productSubtitle ? <p className="text-sm text-slate-500">{productSubtitle}</p> : null}

			<div className="flex items-center gap-2 mt-3 flex-wrap">
				<LoanStatusBadge status={status} />
				<LoanActionPill status={status} />
			</div>

			{status.description ? (
				<p className="mt-3 text-sm text-slate-700">{status.description}</p>
			) : null}

			{summary?.fields?.length ? <FieldRows fields={summary.fields} /> : null}

			{decision ? <DecisionBlock decision={decision} /> : null}
		</section>
	);
}

/** One labelled value per row — the loan summary's rows and a decision's terms
 * are the same shape, so they are the same renderer. One column on a phone,
 * two from `sm`. Values are printed exactly as the server sent them. */
function FieldRows({ fields, strong = false }: { fields: LoanSummaryField[]; strong?: boolean }) {
	return (
		<dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
			{fields.map((field) => (
				<div key={field.label} className="flex items-baseline justify-between gap-3">
					<dt className={LABEL}>{field.label}</dt>
					<dd
						className={`text-sm text-slate-900 text-right ${strong ? "font-semibold" : "font-medium"}`}
					>
						{field.display}
					</dd>
				</div>
			))}
		</dl>
	);
}

/** "outstanding" / "received" are a state, not a label the server authors, so
 * the two words a borrower reads live here — and nowhere else. */
const CONDITION_STATE_LABELS: Record<string, string> = {
	outstanding: "Outstanding",
	received: "Received",
};

function DecisionBlock({ decision }: { decision: LoanDecisionInfo }) {
	const stateLabel = decision.conditions_state
		? CONDITION_STATE_LABELS[decision.conditions_state]
		: undefined;
	const outstanding = decision.conditions_state === "outstanding";
	const decidedOn = formatDate(decision.decided_at);

	return (
		<div className="border-t border-slate-100 mt-5 pt-4 space-y-4">
			{decision.terms.length ? <FieldRows fields={decision.terms} strong /> : null}

			{decision.message ? (
				<p className="text-sm text-slate-700 whitespace-pre-line">{decision.message}</p>
			) : null}

			{decision.conditions.length ? (
				<div className="space-y-2">
					<div className="flex items-center gap-2 flex-wrap">
						<h3 className={LABEL}>Conditions</h3>
						{stateLabel ? (
							<span className={`${PILL} ${loanToneClasses(outstanding ? "warning" : "success")}`}>
								{stateLabel}
							</span>
						) : null}
					</div>
					<ul className="space-y-2">
						{/* Every condition that reaches a borrower is guaranteed a
						    non-blank title and the most specific detail available,
						    so there is no blank-title branch here. */}
						{decision.conditions.map((condition) => (
							<li key={condition.title} className="text-sm">
								<span className="font-medium text-slate-900">{condition.title}</span>
								{condition.detail ? (
									<span className="block text-slate-600">{condition.detail}</span>
								) : null}
							</li>
						))}
					</ul>
					{/* Points at the ONE place the loan screen offers an upload — the
					    "Next step" section below this card — rather than at the chat,
					    which is now the conversation and not where tasks live. */}
					{outstanding ? (
						<p className="text-sm text-slate-600">Upload them under Next step below.</p>
					) : null}
				</div>
			) : null}

			<p className="text-xs text-slate-500">
				{decision.decided_by_name
					? `${decision.decided_by_name}${decidedOn ? ` · ${decidedOn}` : ""}`
					: decidedOn}
			</p>
		</div>
	);
}

/** Locale date, or nothing at all rather than an "Invalid Date". */
function formatDate(value: string | null | undefined): string {
	if (!value) return "";
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString();
}
