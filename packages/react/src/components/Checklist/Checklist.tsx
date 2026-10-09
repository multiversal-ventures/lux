import type { ChecklistItem } from "@multiversal-ventures/lux-core";
import { Check } from "lucide-react";
import { loanToneClasses } from "../LoanStatus/LoanStatusBadge.js";

export interface ChecklistProps {
	items: ChecklistItem[];
	className?: string;
}

/** The only status value that means "we have this" in the portal contract.
 * Everything else — `needed` (an officer's hand-picked item), `incomplete` and
 * `info` (a finding) — is still owed. */
const DONE = "verified";

/** Operator pill shape (`CasesTable`, `LoanStatusBadge`); its colour comes from
 * {@link loanToneClasses}, the single tone → classes map. */
const PILL = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium";

/**
 * What the borrower still owes, as a compact list.
 *
 * Deliberately NOT cards. Four full-width hero cards for four documents dwarfed
 * the status card that should be the most important thing on the page, so a row
 * is one line of title, one line of detail, and a done/outstanding marker.
 *
 * It prints no count of its own: the number of outstanding things lives in
 * `loan_status.action_count` and is rendered once, by the caller. Two counts
 * derived from two lists is how a page ends up contradicting itself.
 *
 * The priority tag shows ONLY when the items actually differ — "high" on every
 * row carries no information. Pure renderer: all state comes from `items`, and
 * an empty list renders nothing at all so the caller owns its own empty copy.
 */
export function Checklist({ items, className }: ChecklistProps) {
	if (items.length === 0) return null;

	const outstanding = items.filter((item) => item.status !== DONE);
	const done = items.filter((item) => item.status === DONE);
	// A tag that is the same on every row is noise; one that differs is a signal.
	const distinctPriorities = new Set(items.map((item) => item.priority).filter(Boolean));
	const showPriority = distinctPriorities.size > 1;

	return (
		<ul className={`divide-y divide-slate-100${className ? ` ${className}` : ""}`}>
			{[...outstanding, ...done].map((item) => (
				<ChecklistRow key={item.id} item={item} showPriority={showPriority} />
			))}
		</ul>
	);
}

function ChecklistRow({ item, showPriority }: { item: ChecklistItem; showPriority: boolean }) {
	const isDone = item.status === DONE;
	return (
		<li className="flex items-start gap-3 py-3">
			{/* The state is a shape and a colour for a sighted reader and a word for
			    a screen reader — no row repeats "Needed" on screen, because a label
			    on every row is the "high on everything" problem again. */}
			{isDone ? (
				<Check size={16} className="mt-0.5 shrink-0 text-green-600" aria-hidden="true" />
			) : (
				<span
					aria-hidden="true"
					className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-slate-300"
				/>
			)}
			<div className="min-w-0 flex-1">
				<p className={`text-sm font-medium ${isDone ? "text-slate-500" : "text-slate-900"}`}>
					<span className="sr-only">{isDone ? "Received: " : "Still needed: "}</span>
					{item.title}
				</p>
				{item.detail ? <p className="text-xs text-slate-500 mt-0.5">{item.detail}</p> : null}
			</div>
			{showPriority && item.priority ? (
				<span className={`${PILL} shrink-0 ${loanToneClasses("neutral")}`}>{item.priority}</span>
			) : null}
		</li>
	);
}
