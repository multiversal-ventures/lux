import type { LoanStatusInfo } from "@multiversal-ventures/lux-core";

export interface LoanStatusBadgeProps {
	status: LoanStatusInfo;
	className?: string;
}

/**
 * The one place a status tone becomes a colour.
 *
 * The server sends `{key, label, tone}` and lux renders it — the label is never
 * derived here, because every string lives in
 * `veritas/policy/specs/borrower_statuses.yaml`. An unknown tone falls back to
 * neutral rather than rendering an unstyled pill.
 */
const TONE_CLASSES: Record<string, string> = {
	neutral: "bg-slate-100 text-slate-600",
	info: "bg-blue-50 text-blue-700",
	warning: "bg-amber-50 text-amber-700",
	success: "bg-green-50 text-green-700",
	danger: "bg-red-50 text-red-700",
};

/** The dot colour per tone — same five keys, same fallback. */
const DOT_CLASSES: Record<string, string> = {
	neutral: "bg-slate-400",
	info: "bg-blue-500",
	warning: "bg-amber-500",
	success: "bg-green-500",
	danger: "bg-red-500",
};

const PILL = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium";

/** Tone → classes, resolved once so every other component in this folder shares
 * one definition instead of re-deriving colour from a status key. */
export function loanToneClasses(tone: string): string {
	return TONE_CLASSES[tone] ?? TONE_CLASSES.neutral;
}

export function LoanStatusBadge({ status, className }: LoanStatusBadgeProps) {
	const dot = DOT_CLASSES[status.tone] ?? DOT_CLASSES.neutral;
	return (
		<span className={`${PILL} ${loanToneClasses(status.tone)}${className ? ` ${className}` : ""}`}>
			<span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
			{status.label}
		</span>
	);
}

/** "N actions needed" — shown WHATEVER the status, because a conditional
 * approval with outstanding conditions is the case that matters. Renders
 * nothing at zero. `action_count` rides on the status; there is no second
 * field for it. */
export function LoanActionPill({ status }: { status: LoanStatusInfo }) {
	const count = status.action_count ?? 0;
	if (count <= 0) return null;
	// Warning's own classes, read from the one map rather than re-spelled:
	// an action pill IS a warning tone.
	return (
		<span className={`${PILL} ${loanToneClasses("warning")}`}>
			{count} {count === 1 ? "action" : "actions"} needed
		</span>
	);
}
