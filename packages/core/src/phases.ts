/**
 * Declarative pipeline phase config — single source of truth for the frontend.
 *
 * Mirrors `gunnr.case.status.PHASES` on the backend.
 * Adding a new phase means updating this file and the backend dict.
 */

export interface PhaseConfig {
	code: string;
	label: string;
	progressStart: number;
	progressEnd: number;
	priority: number;
	/** Stepper: only show if the phase has been reached (e.g. unification). */
	optional?: boolean;
}

export const PHASES: readonly PhaseConfig[] = [
	{ code: "loading", label: "Opening Documents", progressStart: 0, progressEnd: 10, priority: 1 },
	{
		code: "classifying",
		label: "Classifying Pages",
		progressStart: 5,
		progressEnd: 14,
		priority: 2,
	},
	{ code: "extracting", label: "Extracting Data", progressStart: 15, progressEnd: 74, priority: 3 },
	{
		code: "validating",
		label: "Validating Facts",
		progressStart: 75,
		progressEnd: 75,
		priority: 4,
	},
	{
		code: "cross_doc",
		label: "Cross-Document Check",
		progressStart: 76,
		progressEnd: 81,
		priority: 5,
	},
	{
		code: "unification",
		label: "Analyzing Bank Statements",
		progressStart: 82,
		progressEnd: 88,
		priority: 6,
		optional: true,
	},
	{
		code: "income_verification",
		label: "Calculating Income",
		progressStart: 89,
		progressEnd: 98,
		priority: 7,
	},
	{
		code: "reextract",
		label: "Re-analyzing Pages",
		progressStart: 0,
		progressEnd: 0,
		priority: 3,
		optional: true,
	},
	{
		code: "summary",
		label: "Summary",
		progressStart: 0,
		progressEnd: 0,
		priority: 5,
		optional: true,
	},
	{ code: "completed", label: "Completed", progressStart: 100, progressEnd: 100, priority: 8 },
	{ code: "failed", label: "Failed", progressStart: 0, progressEnd: 0, priority: 8 },
] as const;

// ── Derived helpers (computed once at import time) ──────────────────────────

export const PHASE_MAP: Record<string, PhaseConfig> = Object.fromEntries(
	PHASES.map((p) => [p.code, p]),
);

export const PHASE_PRIORITY: Record<string, number> = Object.fromEntries(
	PHASES.map((p) => [p.code, p.priority]),
);

export const ONGOING_CODES = new Set(
	PHASES.filter((p) => p.code !== "completed" && p.code !== "failed").map((p) => p.code),
);

export type CaseStatusCode = (typeof PHASES)[number]["code"] | "cancelled" | "tier4";

// ── Alias normalisation (mirrors backend AEU_TO_LEGACY_STATUS) ─────────────

const NORMALIZE: Record<string, string> = {
	started: "loading",
	preparing: "loading",
	opening: "loading",
	intake: "classifying",
	classification: "classifying",
	extraction: "extracting",
	validation: "validating",
	first_scenario: "income_verification",
	complete: "completed",
	review_required: "completed",
};

export function normalizeStatus(code: string): string {
	return NORMALIZE[code] ?? code;
}

export function getStatusLabel(code: string): string {
	const canonical = normalizeStatus(code);
	return (
		PHASE_MAP[canonical]?.label ?? code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
	);
}

export function isOngoing(code: string): boolean {
	return ONGOING_CODES.has(normalizeStatus(code));
}
