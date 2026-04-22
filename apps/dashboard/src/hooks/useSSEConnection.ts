/**
 * Pure SSE transport hook.
 *
 * Manages EventSource lifecycle, Firebase auth tokens, reconnection with
 * exponential backoff, and resume via Last-Event-ID.
 *
 * All received events are written to the Zustand caseEventStore.
 * This hook knows NOTHING about React Query or server data fetching.
 */

import { useCallback, useEffect, useRef } from "react";
import { getAuth } from "firebase/auth";
import { useCaseEventStore, getStoredEventHead } from "../stores/caseEventStore";
import { getCaseEvents } from "./useApi";
import type { StreamEvent } from "../types";

interface UseSSEConnectionOptions {
	caseId: string | null;
	autoConnect?: boolean;
	maxRetries?: number;
	retryDelay?: number;
	onEvent?: (event: StreamEvent) => void;
	onError?: (error: Error) => void;
}

interface UseSSEConnectionResult {
	connect: () => void;
	disconnect: () => void;
	reconnect: () => void;
	loadEarlierEvents: () => Promise<void>;
}

export function useSSEConnection({
	caseId,
	autoConnect = true,
	maxRetries = 10,
	retryDelay = 1000,
	onEvent,
	onError,
}: UseSSEConnectionOptions): UseSSEConnectionResult {
	const store = useCaseEventStore;
	const eventSourceRef = useRef<EventSource | null>(null);
	const retryCountRef = useRef(0);
	const prevCaseIdRef = useRef<string | null>(null);
	const historicalFetchSeqRef = useRef(0);
	const loadEarlierFetchSeqRef = useRef(0);
	/** Bumped on disconnect / case change so stale reconnects and async connect tails abort. */
	const connectionEpochRef = useRef(0);
	const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const connectRef = useRef<(() => Promise<void>) | null>(null);

	// ─── Process an incoming SSE message ────────────────────────────────────
	const handleMessage = useCallback(
		(event: MessageEvent) => {
			const state = store.getState();
			const activeCaseId = state.caseId;

			// Track last event ID for resume
			if (event.lastEventId) {
				state.setLastEventId(event.lastEventId);
			}

			let data: StreamEvent;
			try {
				data = JSON.parse(event.data);
			} catch {
				return; // heartbeat / non-JSON
			}

			if (data.case_id && activeCaseId && data.case_id !== activeCaseId) {
				return;
			}

			// Write event to Zustand store (deduplication is inside addEvent)
			state.addEvent(data);
			onEvent?.(data);

			// Track loaded files from file-loading observations
			if (data.phase === "loading" && data.data?.file_id && data.data?.filename) {
				const fileData = data.data as {
					file_id: string;
					filename: string;
					page_count: number;
				};
				state.addLoadedFile({
					file_id: fileData.file_id,
					filename: fileData.filename,
					page_count: fileData.page_count || 0,
					status: "loading",
				});
			}

			// Update file status based on phase changes
			if (data.phase === "classification" && data.source?.file_id) {
				state.updateFileStatus(data.source.file_id, "classifying");
			}
			if (data.phase === "extraction" && data.source?.file_id) {
				state.updateFileStatus(data.source.file_id, "extracting");
			}

			// Mark completion + extract scenario ID
			if (data.type === "complete") {
				state.setCompleted(true);
				const scenarioId = (data.data as { scenario_id?: string })?.scenario_id;
				if (scenarioId) {
					state.setFirstScenarioId(scenarioId);
				}
			}

			// Detect tenant restriction (page limit exceeded, etc.)
			if (data.type === "issue" && data.data?.restriction_code) {
				const restrictionData = data.data as {
					restriction_code: string;
					total_pages: number;
					page_limit: number;
				};
				state.setTenantRestriction({
					code: restrictionData.restriction_code,
					message: data.message,
					totalPages: restrictionData.total_pages,
					pageLimit: restrictionData.page_limit,
				});
			}
		},
		[store, onEvent],
	);

	// ─── Fetch historical events on cold load ──────────────────────────────
	const fetchHistoricalEvents = useCallback(async () => {
		if (!caseId) return;

		const requestCaseId = caseId;
		const thisFetchSeq = ++historicalFetchSeqRef.current;
		const isStale = () =>
			thisFetchSeq !== historicalFetchSeqRef.current || store.getState().caseId !== requestCaseId;

		try {
			const storedHead = getStoredEventHead(caseId);

			if (storedHead) {
				const [recentResponse, earlierResponse] = await Promise.all([
					getCaseEvents(caseId, storedHead, 100),
					getCaseEvents(caseId, "0", 100),
				]);
				if (isStale()) return;

				const earlierCount = earlierResponse.events.filter((e) => e.id < storedHead).length;
				store.getState().setEarlierEventsCount(earlierCount);

				if (recentResponse.events.length > 0) {
					store.getState().setEvents(recentResponse.events);
					store.getState().setLastEventId(recentResponse.last_id);
				} else {
					const lastFew = earlierResponse.events.slice(-5);
					if (lastFew.length > 0) {
						store.getState().setEvents(lastFew);
						store.getState().setLastEventId(earlierResponse.last_id);
						store
							.getState()
							.setEarlierEventsCount(Math.max(0, earlierResponse.events.length - lastFew.length));
					}
				}

				const allEvents = [...earlierResponse.events, ...recentResponse.events];
				if (allEvents.some((e) => e.type === "complete")) {
					store.getState().setCompleted(true);
				}
			} else {
				const response = await getCaseEvents(caseId, "0", 100);
				if (isStale()) return;

				if (response.events.length > 0) {
					store.getState().setEvents(response.events);
					store.getState().setLastEventId(response.last_id);
					if (response.events.some((e) => e.type === "complete")) {
						store.getState().setCompleted(true);
					}
				}
				store.getState().setEarlierEventsCount(0);
			}
		} catch {
			// Silent fail -- events are nice to have, not critical
		}
	}, [caseId, store]);

	// ─── Connect to SSE stream ─────────────────────────────────────────────
	const connect = useCallback(async () => {
		if (!caseId) return;
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}

		const startEpoch = connectionEpochRef.current;

		const state = store.getState();
		state.setCompleted(false);
		state.setStreamStatus("connecting");

		// Firebase auth token (force-refresh on retries)
		const forceRefresh = retryCountRef.current > 0;
		const auth = getAuth();
		const user = auth.currentUser;
		let token: string | null = null;

		if (user) {
			try {
				token = await user.getIdToken(forceRefresh);
			} catch (err) {
				console.error("Failed to get auth token for SSE:", err);
				state.setStreamStatus("error");
				onError?.(new Error("Authentication failed"));
				return;
			}
		}

		if (connectionEpochRef.current !== startEpoch) {
			return;
		}

		const myEpoch = connectionEpochRef.current;

		const params = new URLSearchParams();
		if (token) params.set("token", token);
		const lastId = store.getState().lastEventId;
		if (lastId) params.set("Last-Event-ID", lastId);

		const url = `/api/v1/stream/${caseId}${params.toString() ? `?${params}` : ""}`;
		const es = new EventSource(url);
		eventSourceRef.current = es;

		es.onopen = () => {
			if (connectionEpochRef.current !== myEpoch || eventSourceRef.current !== es) {
				return;
			}
			retryCountRef.current = 0;
			store.getState().setStreamStatus("connected");
		};

		es.onerror = (err) => {
			if (connectionEpochRef.current !== myEpoch || eventSourceRef.current !== es) {
				return;
			}
			console.error("[SSE] Connection error:", err);
			store.getState().setStreamStatus("disconnected");

			const completed = store.getState().completed;
			if (!completed && retryCountRef.current < maxRetries) {
				retryCountRef.current++;
				const delay = retryDelay * Math.min(retryCountRef.current, 5);
				const epochAtSchedule = connectionEpochRef.current;
				if (reconnectTimeoutRef.current != null) {
					clearTimeout(reconnectTimeoutRef.current);
				}
				reconnectTimeoutRef.current = setTimeout(() => {
					reconnectTimeoutRef.current = null;
					if (connectionEpochRef.current !== epochAtSchedule) {
						return;
					}
					void connectRef.current?.();
				}, delay);
			} else if (!completed) {
				store.getState().setStreamStatus("error");
				onError?.(new Error("Max retries exceeded"));
			}
		};

		es.onmessage = handleMessage;

		const eventTypes = [
			"phase",
			"thinking",
			"observation",
			"action",
			"finding",
			"issue",
			"complete",
			"retry", // SSE resilience layer: recoverable error
			"fatal", // SSE resilience layer: unrecoverable error
		];
		eventTypes.forEach((type) => {
			es.addEventListener(type, (e) => handleMessage(e as MessageEvent));
		});

		es.addEventListener("timeout", () => {
			// No-op: EventSource will auto-reconnect
		});

		es.addEventListener("error", (e) => {
			try {
				const data = JSON.parse((e as MessageEvent).data || "{}");
				onError?.(new Error(data.error || "Unknown error"));
			} catch {
				// Normal EventSource reconnect error
			}
		});
	}, [caseId, maxRetries, retryDelay, handleMessage, onError, store]);

	useEffect(() => {
		connectRef.current = connect;
	}, [connect]);

	// ─── Disconnect ────────────────────────────────────────────────────────
	const disconnect = useCallback(() => {
		if (reconnectTimeoutRef.current != null) {
			clearTimeout(reconnectTimeoutRef.current);
			reconnectTimeoutRef.current = null;
		}
		connectionEpochRef.current += 1;
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
		store.getState().setStreamStatus("idle");
	}, [store]);

	// ─── Reconnect (reset completed state for new workflow phases) ─────────
	const reconnect = useCallback(() => {
		store.getState().setCompleted(false);
		retryCountRef.current = 0;
		connect();
	}, [connect, store]);

	// ─── Load earlier events on demand ─────────────────────────────────────
	const loadEarlierEvents = useCallback(async () => {
		const state = store.getState();
		if (!state.caseId || state.earlierEventsCount === 0 || state.loadingEarlierEvents) return;

		const requestCaseId = state.caseId;
		const thisFetchSeq = ++loadEarlierFetchSeqRef.current;
		const isStale = () =>
			thisFetchSeq !== loadEarlierFetchSeqRef.current || store.getState().caseId !== requestCaseId;

		state.setLoadingEarlierEvents(true);
		try {
			const response = await getCaseEvents(requestCaseId, "0", 100);
			if (isStale()) return;

			if (response.events.length > 0) {
				const existingIds = new Set(store.getState().events.map((e) => e.id));
				const newEvents = response.events.filter((e) => !existingIds.has(e.id));
				store.getState().setEvents([...newEvents, ...store.getState().events]);
				store.getState().setEarlierEventsCount(0);
			}
		} catch {
			// Silent fail
		} finally {
			if (!isStale()) {
				store.getState().setLoadingEarlierEvents(false);
			}
		}
	}, [store]);

	// ─── Lifecycle: auto-connect/disconnect on caseId change ───────────────
	useEffect(() => {
		const caseChanged = caseId !== prevCaseIdRef.current;

		if (caseChanged) {
			// Invalidate in-flight fetches
			historicalFetchSeqRef.current++;
			loadEarlierFetchSeqRef.current++;
			retryCountRef.current = 0;

			disconnect();
			store.getState().setCaseId(caseId);
			prevCaseIdRef.current = caseId;
		}

		if (caseId) {
			// Load historical events, then connect SSE if not already completed
			fetchHistoricalEvents().then(() => {
				if (autoConnect && !store.getState().completed) {
					connect();
				}
			});
		}

		return () => {
			disconnect();
		};
	}, [caseId, autoConnect]); // eslint-disable-line react-hooks/exhaustive-deps

	return { connect, disconnect, reconnect, loadEarlierEvents };
}
