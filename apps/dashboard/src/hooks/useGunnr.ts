import { useCallback, useEffect, useRef, useState } from "react";
import { resolveApiUrl } from "../lib/api";
import type { StreamEvent, StreamStatus } from "../types";

interface UseGunnrOptions {
	caseId: string | null;
	onEvent?: (event: StreamEvent) => void;
	onComplete?: () => void;
	onError?: (error: Error) => void;
	autoConnect?: boolean;
	maxRetries?: number;
	retryDelay?: number;
}

interface UseGunnrResult {
	events: StreamEvent[];
	status: StreamStatus;
	connect: () => void;
	disconnect: () => void;
	clearEvents: () => void;
}

/**
 * Hook for SSE streaming from Gunnr backend.
 * Manages EventSource connection with auto-reconnect.
 *
 * @deprecated Use useGunnrCase instead - it combines SSE + data fetching
 * following the versioned-state architecture where backend is source of truth.
 */
export function useGunnr({
	caseId,
	onEvent,
	onComplete,
	onError,
	autoConnect = true,
	maxRetries = 10,
	retryDelay = 1000,
}: UseGunnrOptions): UseGunnrResult {
	const [events, setEvents] = useState<StreamEvent[]>([]);
	const [status, setStatus] = useState<StreamStatus>("idle");

	const eventSourceRef = useRef<EventSource | null>(null);
	const lastEventIdRef = useRef<string | null>(null);
	const retryCountRef = useRef(0);
	const completedRef = useRef(false);

	const updateStatus = useCallback((newStatus: StreamStatus) => {
		setStatus(newStatus);
	}, []);

	const handleEvent = useCallback(
		(event: MessageEvent) => {
			if (event.lastEventId) {
				lastEventIdRef.current = event.lastEventId;
			}

			let data: StreamEvent;
			try {
				data = JSON.parse(event.data);
			} catch {
				// Non-JSON data (heartbeat)
				return;
			}

			setEvents((prev) => [...prev, data]);
			onEvent?.(data);
		},
		[onEvent],
	);

	const connect = useCallback(() => {
		if (!caseId) return;
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
		}

		completedRef.current = false;
		updateStatus("connecting");

		const path = lastEventIdRef.current
			? `/api/v1/stream/${caseId}?Last-Event-ID=${encodeURIComponent(lastEventIdRef.current)}`
			: `/api/v1/stream/${caseId}`;
		const resolved = resolveApiUrl(path);
		const absolute =
			resolved.startsWith("http://") || resolved.startsWith("https://")
				? resolved
				: new URL(resolved, window.location.origin).toString();

		const es = new EventSource(absolute);
		eventSourceRef.current = es;

		es.onopen = () => {
			retryCountRef.current = 0;
			updateStatus("connected");
		};

		es.onerror = () => {
			updateStatus("disconnected");

			if (!completedRef.current && retryCountRef.current < maxRetries) {
				retryCountRef.current++;
				setTimeout(connect, retryDelay);
			} else if (!completedRef.current) {
				updateStatus("error");
				onError?.(new Error("Max retries exceeded"));
			}
		};

		es.onmessage = handleEvent;

		// Handle typed events
		const eventTypes = [
			"phase",
			"thinking",
			"observation",
			"action",
			"finding",
			"issue",
			"complete",
		];
		eventTypes.forEach((type) => {
			es.addEventListener(type, (event) => handleEvent(event as MessageEvent));
		});

		// Handle done/error/timeout
		es.addEventListener("done", () => {
			completedRef.current = true;
			es.close();
			eventSourceRef.current = null;
			updateStatus("idle");
			onComplete?.();
		});

		es.addEventListener("error", (event) => {
			try {
				const data = JSON.parse((event as MessageEvent).data || "{}");
				onError?.(new Error(data.error || "Unknown error"));
			} catch {
				// Ignore parse errors
			}
		});

		es.addEventListener("timeout", (event) => {
			try {
				const data = JSON.parse((event as MessageEvent).data || "{}");
				onError?.(new Error(data.message || "Stream timeout"));
			} catch {
				// Ignore parse errors
			}
		});
	}, [caseId, maxRetries, retryDelay, handleEvent, updateStatus, onComplete, onError]);

	const disconnect = useCallback(() => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
		updateStatus("idle");
	}, [updateStatus]);

	const clearEvents = useCallback(() => {
		setEvents([]);
		lastEventIdRef.current = null;
	}, []);

	// Auto-connect when caseId changes
	useEffect(() => {
		if (caseId && autoConnect) {
			clearEvents();
			connect();
		} else {
			disconnect();
		}

		return () => {
			disconnect();
		};
	}, [caseId, autoConnect]); // eslint-disable-line react-hooks/exhaustive-deps

	return {
		events,
		status,
		connect,
		disconnect,
		clearEvents,
	};
}
