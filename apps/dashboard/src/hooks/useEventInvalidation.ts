/**
 * Declarative event-to-React-Query-invalidation bridge.
 *
 * Subscribes to the Zustand caseEventStore (outside React render cycle)
 * and maps incoming SSE events to targeted React Query cache invalidations.
 *
 * Includes 1000ms debounce to batch rapid events (e.g. multiple phase
 * transitions) into a single invalidation pass.
 *
 * Mount this ONCE near the app root (e.g. in CasePage or App).
 */

import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useCaseEventStore } from "../stores/caseEventStore";
import { useReviewAgentStore } from "../stores/reviewAgentStore";
import { caseKeys } from "./useCaseQueries";

// ─── Event → Query Key Mapping ─────────────────────────────────────────────
// Each entry maps an SSE event type to the query keys that should be
// invalidated when that event arrives.

const EVENT_INVALIDATION_MAP: Record<string, (caseId: string) => QueryKey[]> = {
	complete: (caseId) => [
		caseKeys.detail(caseId),
		caseKeys.list,
		caseKeys.scenarios(caseId),
		["case", caseId, "scenario"],
		caseKeys.workflows(caseId),
		caseKeys.income(caseId),
		caseKeys.result(caseId),
		["case", caseId, "stage-excel-url"],
	],
	phase: (caseId) => [caseKeys.status(caseId), caseKeys.progress(caseId)],
	thinking: (caseId) => [caseKeys.status(caseId), caseKeys.progress(caseId)],
	finding: (caseId) => [caseKeys.status(caseId), caseKeys.result(caseId)],
};

const DEBOUNCE_MS = 1000;

function asString(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function getScopedCompleteKeys(
	caseId: string,
	event: { type?: string; data?: Record<string, unknown> },
): QueryKey[] {
	if (event.type !== "complete") return [];

	const scenarioId = asString(event.data?.scenario_id);
	const refinementId = asString(event.data?.refinement_id);
	if (!scenarioId) return [];

	const keys: QueryKey[] = [
		caseKeys.scenarioDetail(caseId, scenarioId),
		caseKeys.scenarioRefinements(caseId, scenarioId),
	];

	if (refinementId) {
		keys.push(caseKeys.refinementDetail(caseId, scenarioId, refinementId));
	}

	return keys;
}

/**
 * Hook that bridges SSE events → React Query invalidation.
 *
 * Uses Zustand's `subscribe` with selector to react only when
 * `events.length` changes, avoiding unnecessary work.
 */
export function useEventInvalidation(): void {
	const queryClient = useQueryClient();

	useEffect(() => {
		let debounceTimer: ReturnType<typeof setTimeout> | null = null;
		let postCompleteRefetchTimer: ReturnType<typeof setTimeout> | null = null;
		const pendingKeys = new Set<string>();
		let sawComplete = false;

		const unsub = useCaseEventStore.subscribe(
			(s) => s.events.length,
			(newLen, prevLen) => {
				if (newLen <= prevLen) return;

				const { events, caseId } = useCaseEventStore.getState();
				if (!caseId) return;

				// Process all new events since last check
				const newEvents = events.slice(prevLen);
				for (const event of newEvents) {
					if (event.type === "complete") {
						sawComplete = true;
					}
					const keys = EVENT_INVALIDATION_MAP[event.type]?.(caseId);
					if (keys) {
						keys.forEach((k) => pendingKeys.add(JSON.stringify(k)));
					}

					// PR #458: scoped invalidation for complete events
					const scopedKeys = getScopedCompleteKeys(caseId, event);
					scopedKeys.forEach((k) => pendingKeys.add(JSON.stringify(k)));

					// Bridge bs_review phase events into the review agent Zustand store
					const eventData = (event as unknown as Record<string, unknown>).data as
						| Record<string, unknown>
						| undefined;
					const phase = (event as unknown as Record<string, unknown>).phase as string | undefined;
					if (phase === "bs_review" && eventData) {
						const store = useReviewAgentStore.getState();
						const status = (eventData as Record<string, unknown>).status as string | undefined;
						if (status === "complete") {
							const decisions = (eventData as Record<string, unknown>).decisions as
								| Array<Record<string, unknown>>
								| undefined;
							if (decisions) {
								store.setDecisions(
									decisions.map((d) => ({
										file_id: String(d.file_id ?? ""),
										page_number: Number(d.page_number ?? 0),
										action: (d.action as "dismiss" | "re_extract") ?? "dismiss",
										reason: String(d.reason ?? ""),
										confidence: Number(d.confidence ?? 0.5),
										accepted: true,
									})),
								);
							}
							store.complete(String((eventData as Record<string, unknown>).summary ?? ""));
							pendingKeys.add(JSON.stringify(caseKeys.bankReviewDecisions(caseId)));
							pendingKeys.add(JSON.stringify(caseKeys.bankPageStats(caseId)));
						}
					}
				}

				if (pendingKeys.size === 0) return;

				// Debounce: batch rapid events into one invalidation pass
				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => {
					const keysToInvalidate = Array.from(pendingKeys).map((k) => JSON.parse(k) as QueryKey);
					const shouldRunFollowupRefetch = sawComplete;

					// console.log('invalidating', pendingKeys);
					keysToInvalidate.forEach((queryKey) => {
						queryClient.invalidateQueries({ queryKey });
					});

					if (postCompleteRefetchTimer) clearTimeout(postCompleteRefetchTimer);
					if (shouldRunFollowupRefetch) {
						// Some completion data is persisted asynchronously; run a delayed
						// active refetch pass so summary cards settle on final values.
						postCompleteRefetchTimer = setTimeout(() => {
							keysToInvalidate.forEach((queryKey) => {
								queryClient.refetchQueries({ queryKey, type: "active" });
							});
							postCompleteRefetchTimer = null;
						}, 1800);
					}

					pendingKeys.clear();
					sawComplete = false;
					debounceTimer = null;
				}, DEBOUNCE_MS);
			},
		);

		return () => {
			unsub();
			if (debounceTimer) clearTimeout(debounceTimer);
			if (postCompleteRefetchTimer) clearTimeout(postCompleteRefetchTimer);
		};
	}, [queryClient]);
}
