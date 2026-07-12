import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
	type DependencyList,
} from "react";
import type { CaseEvent } from "@multiversal-ventures/lux-core";
import { getDefaultClient, isLuxInitialized } from "@multiversal-ventures/lux-core";
import { useQueryClient } from "@tanstack/react-query";
import { useOperatorClientOptional } from "./OperatorProvider.js";

/** Minimal interface that CaseEventsProvider needs from a client. */
interface EventsStreamClient {
	getEvents(caseId: string): Promise<{ data: CaseEvent[] | null; error: { message: string } | null }>;
	streamEventsParsed(
		caseId: string,
		onEvent: (event: CaseEvent) => void,
		onError?: (err: { message: string }) => void,
	): { abort: () => void };
}

/**
 * Adapts the VeritasClient singleton (gunnr-style initLux auth) to the
 * EventsStreamClient interface so CaseEventsProvider works without OperatorProvider.
 */
function buildSingletonEventsClient(): EventsStreamClient {
	return {
		async getEvents(caseId) {
			try {
				const data = await getDefaultClient().getCaseEvents(caseId) as unknown as CaseEvent[];
				return { data, error: null };
			} catch (err) {
				return { data: null, error: { message: err instanceof Error ? err.message : "Network error" } };
			}
		},
		streamEventsParsed(caseId, onEvent, onError) {
			const abort = getDefaultClient().streamCaseEvents(
				caseId,
				(ev) => onEvent(ev as unknown as CaseEvent),
				onError ? (err) => onError({ message: err.message }) : undefined,
			);
			return { abort };
		},
	};
}
import {
	applyScenarioRunSideEffects,
	invalidationMap,
	terminalEventTypes,
} from "./invalidation-map.js";

interface StreamError {
	message: string;
}

interface CaseEventsContextValue {
	events: CaseEvent[];
	connecting: boolean;
	streamClosed: boolean;
	/** Set when backfill fetch or SSE stream connection fails. */
	streamError: StreamError | null;
	caseId: string;
	/** Imperative subscription that doesn't trigger re-render. */
	subscribe: (listener: (event: CaseEvent) => void) => () => void;
}

const CaseEventsContext = createContext<CaseEventsContextValue | null>(null);

/**
 * Non-throwing reader for the events context. Returns just the
 * `subscribe` function (or null when no `<CaseEventsProvider>` is
 * mounted) so infrastructure components can integrate with the event
 * stream when available without forcing every host to wire up SSE.
 */
export function useCaseEventsOptional(): {
	subscribe: (listener: (event: CaseEvent) => void) => () => void;
} | null {
	const ctx = useContext(CaseEventsContext);
	if (!ctx) return null;
	return { subscribe: ctx.subscribe };
}

export interface CaseEventsProviderProps {
	caseId: string;
	autoStop?: boolean;
	children: ReactNode;
}

export function CaseEventsProvider({
	caseId,
	autoStop = true,
	children,
}: CaseEventsProviderProps) {
	const operatorClient = useOperatorClientOptional();
	// Memoize so the client reference is stable between renders — an unstable
	// client would cause the useEffect(deps=[caseId, client]) to re-fire on
	// every render, creating an infinite reconnect loop.
	const client = useMemo<EventsStreamClient>(() => {
		if (operatorClient) return operatorClient;
		if (!isLuxInitialized()) {
			throw new Error(
				"CaseEventsProvider requires either <OperatorProvider> or initLux() to be called first.",
			);
		}
		return buildSingletonEventsClient();
	}, [operatorClient]);
	const queryClient = useQueryClient();

	const [events, setEvents] = useState<CaseEvent[]>([]);
	const [connecting, setConnecting] = useState(true);
	const [streamClosed, setStreamClosed] = useState(false);
	const [streamError, setStreamError] = useState<StreamError | null>(null);

	const seenIds = useRef<Set<number>>(new Set());
	const listeners = useRef<Set<(event: CaseEvent) => void>>(new Set());
	const abortRef = useRef<(() => void) | null>(null);
	const raceGuardTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

	// Keep refs in sync with props so ingestEvent (stored in a useRef) always
	// reads current values rather than capturing stale closures from mount.
	const caseIdRef = useRef(caseId);
	caseIdRef.current = caseId;
	const autoStopRef = useRef(autoStop);
	autoStopRef.current = autoStop;

	// ingestEvent: shared dedup + state + listener dispatch.
	// ``triggerInvalidation=true`` for live SSE events only.
	// Backfill events populate seenIds and state but NEVER fire cache
	// invalidations — replaying 400+ historical events through
	// invalidateQueries causes a request waterfall on every page load.
	const ingestEvent = useRef((event: CaseEvent, triggerInvalidation = true) => {
		if (seenIds.current.has(event.event_id)) return;
		seenIds.current.add(event.event_id);
		setEvents((prev) => [...prev, event]);
		if (triggerInvalidation) {
			console.debug(
				`[lux/SSE] live event received: ${event.event_type} id=${event.event_id} case=${caseIdRef.current}`,
				(event as { event_data?: unknown }).event_data,
			);
		}

		// Fire imperative subscribers. Errors are isolated — never crash the event loop.
		listeners.current.forEach((fn) => {
			try {
				fn(event);
			} catch {
				/* subscriber error is isolated */
			}
		});

		if (!triggerInvalidation) return;

		// Centralized invalidation — use ref so stale caseId doesn't invalidate
		// the wrong case's query keys when caseId prop changes between renders.
		const invalidator = invalidationMap[event.event_type];
		if (invalidator) {
			const keys = invalidator(caseIdRef.current);
			console.debug(
				`[lux/SSE] invalidating ${keys.length} query key(s) for ${event.event_type}`,
				keys,
			);
			for (const key of keys) {
				queryClient.invalidateQueries({ queryKey: key });
			}
		}

		// Cross-store side-effects (e.g. clear the scenarioRunsStore
		// just-started pulse on terminal qualify events) — kept after
		// the React Query invalidation so the UI sees the data refresh
		// before the loader collapses.
		applyScenarioRunSideEffects(event);

		// Race guard: on a terminal qualify event the per-product
		// ``scenario.results`` can be persisted a beat AFTER the event fires,
		// so the immediate invalidation above may refetch scenarios whose
		// ``results`` are still empty — the Summary tab (summary_result) shows
		// income while the product tab shows "No results available" until a
		// manual reload. Re-invalidate scenarios once, shortly after, to pick
		// up the freshly-written results. (One extra fetch on terminal events
		// only — not the historical-replay waterfall.)
		if (event.event_type === "qualify.completed" || event.event_type === "qualify.failed") {
			const cid = caseIdRef.current;
			const t = setTimeout(() => {
				queryClient.invalidateQueries({ queryKey: ["case", cid, "scenarios"] });
			}, 1500);
			raceGuardTimers.current.add(t);
		}

		// Server no longer emits stream.end — no client-side auto-stop needed.
		// Stream lives until component unmounts (abort called in useEffect cleanup).
		// autoStop prop is retained for backwards compatibility but is now a no-op
		// because the server never sends case.system.completed as a terminal signal.
	});

	useEffect(() => {
		let cancelled = false;

		// Reset state when caseId changes.
		seenIds.current = new Set();
		setEvents([]);
		setConnecting(true);
		setStreamClosed(false);
		setStreamError(null);

		async function run() {
			console.info(`[lux/SSE] connecting to case stream: ${caseId}`);
			// Backfill historical events — no invalidation (triggerInvalidation=false).
			// Replaying 400+ historical events through invalidateQueries causes a
			// request waterfall on every mount. Historical data is state-only.
			const res = await client.getEvents(caseId);
			if (cancelled) return;
			if (res.error) {
				setStreamError({ message: res.error.message });
				setConnecting(false);
				return;
			}
			const backfilled = res.data ?? [];
			for (const ev of backfilled) ingestEvent.current(ev, false);

			// If the case already reached a terminal state before we mounted,
			// the terminal event was replayed WITHOUT invalidation (state-only)
			// above — so a query fetched on mount can hold stale/empty data
			// (e.g. product-tab "No results available"). Do ONE broad
			// invalidation so scenarios/results/audit refetch fresh. Single
			// fetch, not the per-event replay waterfall the backfill avoids.
			const sawTerminal = backfilled.some(
				(ev) => ev.event_type === "qualify.completed" || ev.event_type === "qualify.failed",
			);
			if (sawTerminal && !cancelled) {
				queryClient.invalidateQueries({ queryKey: ["case", caseId] });
			}

			// Open SSE stream.
			const { abort } = client.streamEventsParsed(
				caseId,
				(ev) => {
					if (cancelled) return;
					ingestEvent.current(ev);
				},
				(err) => {
					if (cancelled) return;
					setStreamError({ message: err.message });
				},
			);
			abortRef.current = abort;
			setConnecting(false);
			console.info(`[lux/SSE] stream live: ${caseId}`);
		}

		void run();

		return () => {
			cancelled = true;
			abortRef.current?.();
			abortRef.current = null;
			for (const t of raceGuardTimers.current) clearTimeout(t);
			raceGuardTimers.current.clear();
		};
	}, [caseId, client]);

	const subscribe = useRef((listener: (event: CaseEvent) => void) => {
		listeners.current.add(listener);
		return () => {
			listeners.current.delete(listener);
		};
	});

	const value = useMemo<CaseEventsContextValue>(
		() => ({
			events,
			connecting,
			streamClosed,
			streamError,
			caseId,
			subscribe: subscribe.current,
		}),
		[events, connecting, streamClosed, streamError, caseId],
	);

	return (
		<CaseEventsContext.Provider value={value}>
			{children}
		</CaseEventsContext.Provider>
	);
}

export interface UseCaseEventsOptions {
	prefix?: string;
	onEvent?: (event: CaseEvent) => void;
	deps?: DependencyList;
}

export interface UseCaseEventsResult {
	events: CaseEvent[];
	connecting: boolean;
	streamClosed: boolean;
	/** Set when backfill fetch or SSE stream connection fails. */
	streamError: StreamError | null;
	caseId: string;
}

export function useCaseEvents(
	opts: UseCaseEventsOptions = {},
): UseCaseEventsResult {
	const ctx = useContext(CaseEventsContext);
	if (!ctx) {
		throw new Error(
			"useCaseEvents must be used within <CaseEventsProvider>",
		);
	}

	// Imperative subscription path.
	useEffect(() => {
		if (!opts.onEvent) return;
		const unsubscribe = ctx.subscribe(opts.onEvent);
		return unsubscribe;
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, opts.deps ?? [ctx]);

	// Prefix-filtered events view (memoized).
	const filteredEvents = useMemo(() => {
		if (!opts.prefix) return ctx.events;
		return ctx.events.filter((e) => e.event_type.startsWith(opts.prefix!));
	}, [ctx.events, opts.prefix]);

	return {
		events: filteredEvents,
		connecting: ctx.connecting,
		streamClosed: ctx.streamClosed,
		streamError: ctx.streamError,
		caseId: ctx.caseId,
	};
}
