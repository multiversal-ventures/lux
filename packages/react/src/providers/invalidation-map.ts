import type { QueryKey } from "@tanstack/react-query";
import type { CaseEvent } from "@fenero/lux-core";

import { getScenarioRunsStore } from "../state/scenarioRunsStore.js";

/**
 * Event-type → query-keys-to-invalidate table.
 *
 * Each SSE event that arrives via CaseEventsProvider fires the matching
 * entry's key(s) through queryClient.invalidateQueries(). New event
 * types gain invalidation by adding a line here — no hook changes.
 *
 * The ``["case", caseId]`` entry is a deliberate broad-prefix match —
 * React Query's ``invalidateQueries({ queryKey: ["case", caseId] })``
 * invalidates every query whose key starts with that array, which
 * covers ``["case", caseId, "scenarios", "lux"]``,
 * ``["case", caseId, "audit", "lux-scenario"]``,
 * ``["case", caseId, "report-workbook", …]``, etc. without us having to
 * enumerate them all here.
 */
export const invalidationMap: Record<
	string,
	(caseId: string) => QueryKey[]
> = {
	"intake.file.processed": (caseId) => [["documents", caseId]],
	"extraction.completed": (caseId) => [
		["documents", caseId],
		["extractions", caseId],
	],
	"banking.completed": (caseId) => [["banking", caseId]],
	// Qualify lifecycle — covers both terminal outcomes so the UI
	// stops polling/spinning regardless of whether a run succeeded
	// or failed.
	"qualify.completed": (caseId) => [
		["audit", caseId],
		["case", caseId],
	],
	"qualify.failed": (caseId) => [
		["audit", caseId],
		["case", caseId],
	],
	"case.system.completed": (caseId) => [["case", caseId]],
};

/** No event terminates the SSE stream server-side. Stream closes only on client disconnect.
 *  Kept as empty set for backwards compatibility with code that checks it. */
export const terminalEventTypes = new Set<string>();

/**
 * Side-effects that fire on certain events ALONGSIDE query invalidation
 * — the loader pulse store needs to be cleared the moment the server
 * confirms a run has finished, otherwise ``useScenarioRunningState``
 * keeps the panel visible until the 60s TTL expires.
 *
 * Kept separate from ``invalidationMap`` so the pure data-cache
 * invalidation contract stays auditable; cross-cutting "tell zustand
 * the run is done" concerns live here.
 */
export function applyScenarioRunSideEffects(event: CaseEvent): void {
	if (event.event_type !== "qualify.completed" && event.event_type !== "qualify.failed") {
		return;
	}
	// The qualify activity stamps ``scenario_id`` into the event's
	// ``event_data`` payload (see ``_qualify_activity_body`` /
	// ``_emit_qualify_failed`` in veritas). Clear the pulse for that
	// scenario so the loader collapses immediately on receipt of the
	// terminal event — the React Query refetch triggered above lands a
	// few hundred ms later, but the pulse clear cuts the latency.
	const data = (event as { event_data?: { scenario_id?: string } }).event_data;
	const scenarioId = data?.scenario_id;
	if (typeof scenarioId === "string" && scenarioId.length > 0) {
		getScenarioRunsStore().getState().clearJustStarted(scenarioId);
	}
}
