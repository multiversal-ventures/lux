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
import type { CaseEvent } from "@fenero/lux-core";
import { useQueryClient } from "@tanstack/react-query";
import { useOperatorClient } from "./OperatorProvider.js";
import { invalidationMap, terminalEventTypes } from "./invalidation-map.js";

interface CaseEventsContextValue {
	events: CaseEvent[];
	connecting: boolean;
	streamClosed: boolean;
	caseId: string;
	/** Imperative subscription that doesn't trigger re-render. */
	subscribe: (listener: (event: CaseEvent) => void) => () => void;
}

const CaseEventsContext = createContext<CaseEventsContextValue | null>(null);

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
	const client = useOperatorClient();
	const queryClient = useQueryClient();

	const [events, setEvents] = useState<CaseEvent[]>([]);
	const [connecting, setConnecting] = useState(true);
	const [streamClosed, setStreamClosed] = useState(false);

	const seenIds = useRef<Set<number>>(new Set());
	const listeners = useRef<Set<(event: CaseEvent) => void>>(new Set());
	const abortRef = useRef<(() => void) | null>(null);

	// Keep refs in sync with props so ingestEvent (stored in a useRef) always
	// reads current values rather than capturing stale closures from mount.
	const caseIdRef = useRef(caseId);
	caseIdRef.current = caseId;
	const autoStopRef = useRef(autoStop);
	autoStopRef.current = autoStop;

	const ingestEvent = useRef((event: CaseEvent) => {
		if (seenIds.current.has(event.event_id)) return;
		seenIds.current.add(event.event_id);
		setEvents((prev) => [...prev, event]);

		// Fire imperative subscribers. Errors are isolated — never crash the event loop.
		listeners.current.forEach((fn) => {
			try {
				fn(event);
			} catch {
				/* subscriber error is isolated */
			}
		});

		// Centralized invalidation — use ref so stale caseId doesn't invalidate
		// the wrong case's query keys when caseId prop changes between renders.
		const invalidator = invalidationMap[event.event_type];
		if (invalidator) {
			for (const key of invalidator(caseIdRef.current)) {
				queryClient.invalidateQueries({ queryKey: key });
			}
		}

		if (autoStopRef.current && terminalEventTypes.has(event.event_type)) {
			abortRef.current?.();
			abortRef.current = null;
			setStreamClosed(true);
		}
	});

	useEffect(() => {
		let cancelled = false;

		// Reset state when caseId changes.
		seenIds.current = new Set();
		setEvents([]);
		setConnecting(true);
		setStreamClosed(false);

		async function run() {
			// Backfill historical events.
			const res = await client.getEvents(caseId);
			if (cancelled) return;
			if (res.data) {
				for (const ev of res.data) ingestEvent.current(ev);
			}

			// Open SSE stream.
			const { abort } = client.streamEventsParsed(caseId, (ev) => {
				if (cancelled) return;
				ingestEvent.current(ev);
			});
			abortRef.current = abort;
			setConnecting(false);
		}

		void run();

		return () => {
			cancelled = true;
			abortRef.current?.();
			abortRef.current = null;
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
			caseId,
			subscribe: subscribe.current,
		}),
		[events, connecting, streamClosed, caseId],
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
		caseId: ctx.caseId,
	};
}
