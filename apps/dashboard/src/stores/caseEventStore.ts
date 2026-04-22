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
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { StreamEvent, StreamStatus, LoadedFile } from "../types";

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
	addEvent: (event: StreamEvent) => void;
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
			// Reset all state when switching cases
			set({ ...INITIAL_STATE, caseId });
		},

		setStreamStatus: (streamStatus) => set({ streamStatus }),

		setCompleted: (completed) => set({ completed }),

		addEvent: (event) => {
			const { events, caseId } = get();
			if (events.some((e) => e.id === event.id)) return;
			if (import.meta.env.DEV) {
				console.debug(
					"[SSE]",
					event.type,
					"|",
					event.data?.name ?? event.message,
					"| status:",
					event.data?.status,
					"| progress:",
					event.data?.progress_pct,
				);
			}
			set({ events: [...events, event] });
			// Persist head to localStorage for SSE resume
			if (caseId && event.id) {
				setStoredEventHead(caseId, event.id);
			}
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
			set({ events: [], loadedFiles: [], earlierEventsCount: 0, lastEventId: null });
		},

		reset: () => set({ ...INITIAL_STATE }),
	})),
);
