import type { QueryKey } from "@tanstack/react-query";

/**
 * Event-type → query-keys-to-invalidate table.
 *
 * Each SSE event that arrives via CaseEventsProvider fires the matching
 * entry's key(s) through queryClient.invalidateQueries(). New event
 * types gain invalidation by adding a line here — no hook changes.
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
	"qualify.completed": (caseId) => [
		["audit", caseId],
		["case", caseId],
	],
	"case.system.completed": (caseId) => [["case", caseId]],
};

/** Event types that, when autoStop is true, terminate the SSE stream. */
export const terminalEventTypes = new Set(["case.system.completed"]);
