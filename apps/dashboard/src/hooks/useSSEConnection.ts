/**
 * Pure SSE transport hook.
 *
 * Manages EventSource lifecycle, Firebase auth tokens, reconnection with
 * exponential backoff, and resume via Last-Event-ID.
 *
 * All received events are written to the Zustand caseEventStore.
 * This hook knows NOTHING about React Query or server data fetching.
 */

import { getDefaultClient, getLuxToken } from "@fenero/lux-core";
import { useCallback, useEffect, useRef } from "react";
import { getStoredEventHead, useCaseEventStore } from "../stores/caseEventStore";
import type { StreamEvent } from "../types";
import { getCaseEvents } from "./useApi";

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

			let data: StreamEvent;
			try {
				data = JSON.parse(event.data);
			} catch {
				return; // heartbeat / non-JSON
			}

			if (data.case_id && activeCaseId && data.case_id !== activeCaseId) {
				return;
			}

			// Buffered + deduped in the store (see caseEventStore.processSSEEvent)
			state.processSSEEvent(data, event.lastEventId || undefined);
			onEvent?.(data);
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
		let token: string | null = null;
		try {
			token = await getLuxToken(forceRefresh);
		} catch (err) {
			console.error("Failed to get auth token for SSE:", err);
			state.setStreamStatus("error");
			onError?.(new Error("Authentication failed"));
			return;
		}

		if (connectionEpochRef.current !== startEpoch) {
			return;
		}

		const myEpoch = connectionEpochRef.current;

		const params = new URLSearchParams();
		if (token) params.set("token", token);
		const lastId = store.getState().lastEventId;
		if (lastId) params.set("Last-Event-ID", lastId);

		const path = `/api/v1/stream/${caseId}${params.toString() ? `?${params}` : ""}`;
		const absolute = getDefaultClient().toAbsoluteUrl(path);
		const es = new EventSource(absolute);
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
