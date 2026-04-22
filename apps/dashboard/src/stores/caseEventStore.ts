/**
 * Zustand store for SSE event stream and connection state.
 *
 * Owns all realtime/ephemeral state that does NOT belong in React Query:
 *   - SSE connection status (connected/disconnected/error)
 *   - Event stream for Agent Chattr sidebar display
 *   - File loading progress (derived from SSE observations)
 *   - First Scenario ID (from SSE complete event)
 *
 * React Query remains the single source of truth for server state
 * (case status, result, income, credit, workflows, etc.).
 *
 * Uses `subscribeWithSelector` so useEventInvalidation can subscribe
 * to event changes outside the React render cycle.
 *
 * IMPORTANT: SSE events are buffered and flushed via setTimeout(0) to
 * avoid "Maximum update depth exceeded". See the buffer section below
 * for the full explanation of the React SyncLane / nestedUpdateCount
 * interaction that necessitates this.
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { LoadedFile, StreamEvent, StreamStatus } from "../types";

// ─── LocalStorage helpers for event head tracking ───────────────────────────
const STORAGE_KEY_PREFIX = "gunnr:case:";

export function getStoredEventHead(caseId: string): string | null {
	try {
		return localStorage.getItem(`${STORAGE_KEY_PREFIX}${caseId}:lastEventId`);
	} catch {
		return null;
	}
}

export function setStoredEventHead(caseId: string, eventId: string): void {
	try {
		localStorage.setItem(`${STORAGE_KEY_PREFIX}${caseId}:lastEventId`, eventId);
	} catch {
		// localStorage not available
	}
}

export function clearStoredEventHead(caseId: string): void {
	try {
		localStorage.removeItem(`${STORAGE_KEY_PREFIX}${caseId}:lastEventId`);
	} catch {
		// localStorage not available
	}
}

// ─── Tenant Restriction (page limit exceeded, etc.) ─────────────────────────

export interface TenantRestriction {
	code: string; // e.g., "PAGE_LIMIT_EXCEEDED"
	message: string;
	totalPages: number;
	pageLimit: number;
}

// ─── SSE event buffer (setTimeout-deferred) ─────────────────────────────────
// Held outside Zustand state so buffering itself never triggers re-renders.
//
// Why setTimeout(0) instead of queueMicrotask:
// React's useSyncExternalStore uses SyncLane. When executionContext === NoContext
// (true for EventSource callbacks), React calls flushSyncWorkOnAllRoots() INLINE
// during scheduleUpdateOnFiber — each set() triggers a synchronous render+commit
// that increments nestedUpdateCount. Passive effects (which reset the counter)
// are flushed via a MessageChannel macrotask.
//
// queueMicrotask runs BEFORE MessageChannel (microtasks drain before macrotasks),
// so nestedUpdateCount hasn't reset yet when the flush fires.
//
// setTimeout(0) runs AFTER MessageChannel, so the counter is guaranteed to be 0
// when our single set() fires. The ~4ms browser clamping is imperceptible.

interface BufferedSSEEvent {
	data: StreamEvent;
	sseLastEventId?: string;
}

let _pendingBatch: BufferedSSEEvent[] = [];
let _flushScheduled = false;
let _flushTimer: ReturnType<typeof setTimeout> | null = null;
const _seenIds: Set<string> = new Set();

function _resetBuffer() {
	_pendingBatch = [];
	if (_flushTimer !== null) {
		clearTimeout(_flushTimer);
		_flushTimer = null;
	}
	_flushScheduled = false;
	_seenIds.clear();
}

// ─── Store State ────────────────────────────────────────────────────────────

interface CaseEventState {
	// Which case this store is scoped to
	caseId: string | null;

	// SSE connection
	streamStatus: StreamStatus;
	completed: boolean;

	// Event stream (display only -- Agent Chattr sidebar)
	events: StreamEvent[];
	earlierEventsCount: number;
	loadingEarlierEvents: boolean;

	// File loading progress (from SSE observations)
	loadedFiles: LoadedFile[];

	// First Scenario auto-navigation (from SSE complete event data)
	firstScenarioId: string | null;

	// Last event ID for SSE resume
	lastEventId: string | null;

	// Tenant restriction popup (page limit exceeded, etc.)
	tenantRestriction: TenantRestriction | null;

	// Actions
	setCaseId: (caseId: string | null) => void;
	setStreamStatus: (status: StreamStatus) => void;
	setCompleted: (completed: boolean) => void;
	/** Enqueue an SSE event into the deferred buffer. Returns true if accepted
	 *  (not a duplicate). The actual Zustand set() fires once per setTimeout(0),
	 *  after React's passive effects flush resets nestedUpdateCount. */
	processSSEEvent: (data: StreamEvent, sseLastEventId?: string) => boolean;
	setEvents: (events: StreamEvent[]) => void;
	setEarlierEventsCount: (count: number) => void;
	setLoadingEarlierEvents: (loading: boolean) => void;
	addLoadedFile: (file: LoadedFile) => void;
	updateFileStatus: (fileId: string, status: LoadedFile["status"]) => void;
	setFirstScenarioId: (id: string | null) => void;
	setLastEventId: (id: string | null) => void;
	setTenantRestriction: (restriction: TenantRestriction | null) => void;
	clearEvents: () => void;
	reset: () => void;
}

const INITIAL_STATE = {
	caseId: null as string | null,
	streamStatus: "idle" as StreamStatus,
	completed: false,
	events: [] as StreamEvent[],
	earlierEventsCount: 0,
	loadingEarlierEvents: false,
	loadedFiles: [] as LoadedFile[],
	firstScenarioId: null as string | null,
	lastEventId: null as string | null,
	tenantRestriction: null as TenantRestriction | null,
};

export const useCaseEventStore = create<CaseEventState>()(
	subscribeWithSelector((set, get) => ({
		...INITIAL_STATE,

		setCaseId: (caseId) => {
			const current = get().caseId;
			if (caseId === current) return;
			_resetBuffer();
			set({ ...INITIAL_STATE, caseId });
		},

		setStreamStatus: (streamStatus) => set({ streamStatus }),

		setCompleted: (completed) => set({ completed }),

		processSSEEvent: (data, sseLastEventId) => {
			// Dedup against committed store state AND pending buffer
			if (get().events.some((e) => e.id === data.id)) return false;
			if (_seenIds.has(data.id)) return false;

			_seenIds.add(data.id);
			_pendingBatch.push({ data, sseLastEventId });

			if (!_flushScheduled) {
				_flushScheduled = true;
				_flushTimer = setTimeout(() => {
					const batch = _pendingBatch;
					_resetBuffer();

					if (batch.length === 0) return;

					const state = get();

					// Build delta with ONLY changed fields to minimise subscriber notifications
					const delta: Partial<CaseEventState> = {
						events: [...state.events, ...batch.map((b) => b.data)],
					};

					let loadedFiles = state.loadedFiles;
					let loadedFilesChanged = false;
					let newLastEventId: string | null = null;

					for (const { data: ev, sseLastEventId: evId } of batch) {
						if (evId) newLastEventId = evId;

						// File loading progress
						if (ev.phase === "loading" && ev.data?.file_id && ev.data?.filename) {
							const fileId = ev.data.file_id as string;
							if (!loadedFiles.some((f) => f.file_id === fileId)) {
								loadedFiles = [
									...loadedFiles,
									{
										file_id: fileId,
										filename: ev.data.filename as string,
										page_count: (ev.data.page_count as number) || 0,
										status: "loading" as const,
									},
								];
								loadedFilesChanged = true;
							}
						}

						// File status transitions
						if (ev.phase === "classification" && ev.source?.file_id) {
							const fid = ev.source.file_id;
							let updated = false;
							const next = loadedFiles.map((f) => {
								if (f.file_id !== fid) return f;
								if (f.status === "classifying") return f;
								updated = true;
								return { ...f, status: "classifying" as const };
							});
							if (updated) {
								loadedFiles = next;
								loadedFilesChanged = true;
							}
						}
						if (ev.phase === "extraction" && ev.source?.file_id) {
							const fid = ev.source.file_id;
							let updated = false;
							const next = loadedFiles.map((f) => {
								if (f.file_id !== fid) return f;
								if (f.status === "extracting") return f;
								updated = true;
								return { ...f, status: "extracting" as const };
							});
							if (updated) {
								loadedFiles = next;
								loadedFilesChanged = true;
							}
						}

						// Completion + scenario ID
						if (ev.type === "complete") {
							delta.completed = true;
							const sid = (ev.data as Record<string, unknown> | undefined)?.scenario_id;
							if (typeof sid === "string") delta.firstScenarioId = sid;
						}

						// Tenant restriction
						if (ev.type === "issue" && ev.data?.restriction_code) {
							delta.tenantRestriction = {
								code: ev.data.restriction_code as string,
								message: ev.message,
								totalPages: ev.data.total_pages as number,
								pageLimit: ev.data.page_limit as number,
							};
						}
					}

					if (newLastEventId !== null) delta.lastEventId = newLastEventId;
					if (loadedFilesChanged) delta.loadedFiles = loadedFiles;

					set(delta);

					// Persist the last event ID to localStorage for SSE resume
					const caseId = state.caseId;
					if (caseId && newLastEventId) {
						setStoredEventHead(caseId, newLastEventId);
					}
				}, 0);
			}

			return true;
		},

		setEvents: (events) => set({ events }),

		setEarlierEventsCount: (earlierEventsCount) => set({ earlierEventsCount }),

		setLoadingEarlierEvents: (loadingEarlierEvents) => set({ loadingEarlierEvents }),

		addLoadedFile: (file) => {
			const { loadedFiles } = get();
			if (loadedFiles.some((f) => f.file_id === file.file_id)) return;
			set({ loadedFiles: [...loadedFiles, file] });
		},

		updateFileStatus: (fileId, status) =>
			set((s) => ({
				loadedFiles: s.loadedFiles.map((f) => (f.file_id === fileId ? { ...f, status } : f)),
			})),

		setFirstScenarioId: (firstScenarioId) => set({ firstScenarioId }),

		setLastEventId: (lastEventId) => set({ lastEventId }),

		setTenantRestriction: (tenantRestriction) => set({ tenantRestriction }),

		clearEvents: () => {
			const { caseId } = get();
			if (caseId) clearStoredEventHead(caseId);
			_resetBuffer();
			set({ events: [], loadedFiles: [], earlierEventsCount: 0, lastEventId: null });
		},

		reset: () => {
			_resetBuffer();
			set({ ...INITIAL_STATE });
		},
	})),
);
