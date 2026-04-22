/**
 * Unified hook for case data + SSE events.
 *
 * This is a thin composition layer over:
 *   - React Query (server state: status, result)
 *   - Zustand caseEventStore (SSE events, connection state, loaded files)
 *   - useSSEConnection (SSE transport)
 *   - useEventInvalidation (SSE → React Query cache bridge)
 *
 * The return type is backward-compatible with the original useGunnrCase.
 * Consumers can migrate incrementally by importing from the individual
 * hooks/stores directly.
 */

import type { StreamEvent, StreamStatus, CaseStatus, CaseResult, LoadedFile } from "../types";
import { useCaseEventStore } from "../stores/caseEventStore";
import { useSSEConnection } from "./useSSEConnection";
import { useEventInvalidation } from "./useEventInvalidation";
import { useCaseStatus, useCaseResult, useCaseProgress } from "./useCaseQueries";

interface UseGunnrCaseOptions {
	caseId: string | null;
	onEvent?: (event: StreamEvent) => void;
	onComplete?: () => void;
	onError?: (error: Error) => void;
	autoConnect?: boolean;
	maxRetries?: number;
	retryDelay?: number;
}

interface UseGunnrCaseResult {
	status: CaseStatus | null;
	result: CaseResult | null;
	events: StreamEvent[];
	streamStatus: StreamStatus;
	loadedFiles: LoadedFile[];
	earlierEventsCount: number;
	loadingEarlierEvents: boolean;
	firstScenarioId: string | null;
	loading: boolean;
	error: string | null;
	refetch: () => Promise<void>;
	connect: () => void;
	disconnect: () => void;
	reconnect: () => void;
	clearEvents: () => void;
	loadEarlierEvents: () => Promise<void>;
}

export function useGunnrCase({
	caseId,
	onEvent,
	onError,
	autoConnect = true,
	maxRetries = 10,
	retryDelay = 1000,
}: UseGunnrCaseOptions): UseGunnrCaseResult {
	// ─── SSE → React Query invalidation bridge ───────────────────────────
	useEventInvalidation();

	// ─── SSE transport (writes to Zustand store) ─────────────────────────
	const { connect, disconnect, reconnect, loadEarlierEvents } = useSSEConnection({
		caseId,
		autoConnect,
		maxRetries,
		retryDelay,
		onEvent,
		onError,
	});

	// ─── Server state from React Query (single source of truth) ──────────
	const statusQuery = useCaseStatus(caseId);
	const resultQuery = useCaseResult(caseId);
	const progressQuery = useCaseProgress(caseId);

	// Use result when complete, otherwise fall back to progress data
	const isCompleted = statusQuery.data?.status.code === "completed";
	const serverResult = isCompleted ? (resultQuery.data ?? null) : (progressQuery.data ?? null);

	// ─── Ephemeral state from Zustand store ──────────────────────────────
	const events = useCaseEventStore((s) => s.events);
	const streamStatus = useCaseEventStore((s) => s.streamStatus);
	const loadedFiles = useCaseEventStore((s) => s.loadedFiles);
	const earlierEventsCount = useCaseEventStore((s) => s.earlierEventsCount);
	const loadingEarlierEvents = useCaseEventStore((s) => s.loadingEarlierEvents);
	const firstScenarioId = useCaseEventStore((s) => s.firstScenarioId);

	// ─── Refetch (invalidates React Query cache) ─────────────────────────
	const refetch = async () => {
		if (caseId) {
			await statusQuery.refetch();
			if (isCompleted) {
				await resultQuery.refetch();
			} else {
				await progressQuery.refetch();
			}
		}
	};

	// ─── Clear events (delegate to store) ────────────────────────────────
	const clearEvents = () => {
		useCaseEventStore.getState().clearEvents();
	};

	return {
		status: statusQuery.data ?? null,
		result: serverResult,
		events,
		streamStatus,
		loadedFiles,
		earlierEventsCount,
		loadingEarlierEvents,
		firstScenarioId,
		loading: statusQuery.isLoading || resultQuery.isLoading,
		error: statusQuery.error?.message ?? resultQuery.error?.message ?? null,
		refetch,
		connect,
		disconnect,
		reconnect,
		clearEvents,
		loadEarlierEvents,
	};
}
