import type {
	LoanDecisionInfo,
	LoanStatusInfo,
	LoanSummaryInfo,
} from "@multiversal-ventures/lux-core";
import { useState } from "react";
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

/**
 * What one borrower is told about one loan.
 *
 * Collapsible, defaulting to expanded when a decision exists — a published
 * outcome is the thing they came to read — and collapsed otherwise, so a case
 * still in processing stays a one-line status.
 *
 * Every string the borrower reads is server data: the status label, tone and
 * description come from `borrower_statuses.yaml`, the summary rows from the
 * product's `borrower_view.summary`, and the decision's terms from the stored
 * `case_decisions` snapshot. Nothing here is recomputed or re-labelled, and no
 * term value is rendered without a decision to carry it.
 */
export function LoanStatusCard({ status, summary, decision, className }: LoanStatusCardProps) {
	const [expanded, setExpanded] = useState<boolean>(Boolean(decision));
	const subject = summary?.property_label || summary?.product_label || null;
	const toggleLabel = decision
		? expanded
			? "Hide terms"
			: "View terms"
		: expanded
			? "Hide details"
			: "View details";

	return (
		<div
			className={`bg-white rounded-lg border border-slate-200 shadow-sm p-6${className ? ` ${className}` : ""}`}
		>
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					{subject ? (
						<h3 className="text-base font-semibold text-slate-900 truncate">{subject}</h3>
					) : null}
					{subject && summary?.product_label && summary.property_label ? (
						<p className="text-sm text-slate-500">{summary.product_label}</p>
					) : null}
					<div className="flex items-center gap-2 mt-2 flex-wrap">
						<LoanStatusBadge status={status} />
						<LoanActionPill status={status} />
					</div>
				</div>
				<button
					type="button"
					onClick={() => setExpanded((v) => !v)}
					aria-expanded={expanded}
					className="shrink-0 text-sm font-medium text-blue-700 hover:text-blue-900 cursor-pointer transition-colors"
				>
					{toggleLabel}
				</button>
			</div>

			{expanded ? (
				<div className="mt-4 space-y-4">
					{status.description ? (
						<p className="text-sm text-slate-600">{status.description}</p>
					) : null}

					{summary?.fields?.length ? (
						<dl className="grid grid-cols-2 gap-x-6 gap-y-2">
							{summary.fields.map((field) => (
								<div key={field.label} className="flex items-baseline justify-between gap-3">
									<dt className="text-xs text-slate-500 uppercase tracking-wider">{field.label}</dt>
									<dd className="text-sm font-medium text-slate-900">{field.display}</dd>
								</div>
							))}
						</dl>
					) : null}

					{decision ? <DecisionBlock decision={decision} /> : null}
				</div>
			) : null}
		</div>
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
		<div className="border-t border-slate-100 pt-4 space-y-4">
			{decision.terms.length ? (
				<dl className="grid grid-cols-2 gap-x-6 gap-y-2">
					{decision.terms.map((term) => (
						<div key={term.label} className="flex items-baseline justify-between gap-3">
							<dt className="text-xs text-slate-500 uppercase tracking-wider">{term.label}</dt>
							<dd className="text-sm font-semibold text-slate-900">{term.display}</dd>
						</div>
					))}
				</dl>
			) : null}

			{decision.message ? (
				<p className="text-sm text-slate-700 whitespace-pre-line">{decision.message}</p>
			) : null}

			{decision.conditions.length ? (
				<div className="space-y-2">
					<div className="flex items-center gap-2">
						<h4 className="text-sm font-semibold text-slate-900">Conditions</h4>
						{stateLabel ? (
							<span
								className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${loanToneClasses(
									outstanding ? "warning" : "success",
								)}`}
							>
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
					{outstanding ? <p className="text-sm text-slate-600">Upload in the chat below</p> : null}
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
