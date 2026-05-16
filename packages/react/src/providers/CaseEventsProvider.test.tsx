import { render, renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { CaseEvent, OperatorClient } from "@multiversal-ventures/lux-core";
import { OperatorProvider } from "./OperatorProvider.js";
import { CaseEventsProvider, useCaseEvents } from "./CaseEventsProvider.js";

type EventCallback = (event: CaseEvent) => void;

function makeFakeClient(options: {
	initial?: CaseEvent[];
	onStream?: (cb: EventCallback) => () => void;
} = {}): OperatorClient {
	const { initial = [], onStream } = options;
	return {
		getEvents: vi.fn().mockResolvedValue({ data: initial, error: null }),
		streamEventsParsed: vi.fn().mockImplementation((_cid: string, cb: EventCallback) => {
			const abort = onStream?.(cb) ?? (() => {});
			return { abort };
		}),
	} as unknown as OperatorClient;
}

function makeWrapper(fakeClient: OperatorClient, caseId: string, qc?: QueryClient) {
	const qcInstance = qc ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return ({ children }: { children: React.ReactNode }) => (
		<QueryClientProvider client={qcInstance}>
			<OperatorProvider bearerToken="t" queryClient={qcInstance}>
				<FakeClientInjector client={fakeClient}>
					<CaseEventsProvider caseId={caseId}>{children}</CaseEventsProvider>
				</FakeClientInjector>
			</OperatorProvider>
		</QueryClientProvider>
	);
}

// Tiny helper that overrides the client for the subtree. Real OperatorProvider
// creates a new client from the token; tests need to inject a fake, so we
// re-export the Operator context here.
import { createContext, useContext } from "react";
// We cheat: publish a second context whose value wins for descendants
// by wrapping the real OperatorProvider's child tree. This keeps the
// provider code unchanged while letting tests stub the client.
const FakeClientContext = createContext<OperatorClient | null>(null);
function FakeClientInjector({ client, children }: { client: OperatorClient; children: React.ReactNode }) {
	return <FakeClientContext.Provider value={client}>{children}</FakeClientContext.Provider>;
}

// Patch CaseEventsProvider's client lookup: we use vi.mock below to
// intercept useOperatorClient and return the fake client instead.

vi.mock("./OperatorProvider", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./OperatorProvider")>();
	return {
		...actual,
		useOperatorClient: () => {
			const fake = useContext(FakeClientContext);
			if (!fake) throw new Error("test: FakeClientInjector missing");
			return fake;
		},
	};
});

describe("CaseEventsProvider", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("backfills historical events on mount", async () => {
		const initial: CaseEvent[] = [
			{ event_id: 1, event_type: "intake.started", event_data: null, created_at: null },
		];
		const client = makeFakeClient({ initial });
		const { result } = renderHook(() => useCaseEvents(), {
			wrapper: makeWrapper(client, "case-1"),
		});
		await waitFor(() => {
			expect(result.current.events).toHaveLength(1);
			expect(result.current.events[0].event_type).toBe("intake.started");
		});
		expect(client.getEvents).toHaveBeenCalledWith("case-1");
	});

	it("delivers new events via SSE stream", async () => {
		let emit: EventCallback = () => {};
		const client = makeFakeClient({
			onStream: (cb) => {
				emit = cb;
				return () => {};
			},
		});
		const { result } = renderHook(() => useCaseEvents(), {
			wrapper: makeWrapper(client, "case-1"),
		});
		await waitFor(() => expect(client.streamEventsParsed).toHaveBeenCalled());

		act(() => {
			emit({
				event_id: 2,
				event_type: "extraction.completed",
				event_data: null,
				created_at: null,
			});
		});
		await waitFor(() => {
			expect(result.current.events.some((e) => e.event_id === 2)).toBe(true);
		});
	});

	it("filters by prefix when requested", async () => {
		let emit: EventCallback = () => {};
		const client = makeFakeClient({
			initial: [
				{ event_id: 1, event_type: "intake.started", event_data: null, created_at: null },
			],
			onStream: (cb) => {
				emit = cb;
				return () => {};
			},
		});
		const { result } = renderHook(() => useCaseEvents({ prefix: "qualify." }), {
			wrapper: makeWrapper(client, "c"),
		});
		await waitFor(() => expect(client.streamEventsParsed).toHaveBeenCalled());

		act(() => {
			emit({ event_id: 2, event_type: "qualify.started", event_data: null, created_at: null });
		});
		await waitFor(() => {
			expect(result.current.events).toHaveLength(1);
			expect(result.current.events[0].event_type).toBe("qualify.started");
		});
	});

	it("deduplicates events by event_id (backfill/stream race)", async () => {
		let emit: EventCallback = () => {};
		const dup = { event_id: 7, event_type: "extraction.started", event_data: null, created_at: null };
		const client = makeFakeClient({
			initial: [dup],
			onStream: (cb) => {
				emit = cb;
				return () => {};
			},
		});
		const { result } = renderHook(() => useCaseEvents(), {
			wrapper: makeWrapper(client, "c"),
		});
		await waitFor(() => expect(result.current.events).toHaveLength(1));
		act(() => emit(dup));
		// Small wait to let a potential re-render settle.
		await new Promise((r) => setTimeout(r, 10));
		expect(result.current.events).toHaveLength(1);
	});

	it("invalidates documents + extractions on extraction.completed", async () => {
		const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const spy = vi.spyOn(qc, "invalidateQueries");
		let emit: EventCallback = () => {};
		const client = makeFakeClient({
			onStream: (cb) => {
				emit = cb;
				return () => {};
			},
		});
		renderHook(() => useCaseEvents(), {
			wrapper: makeWrapper(client, "case-9", qc),
		});
		await waitFor(() => expect(client.streamEventsParsed).toHaveBeenCalled());

		act(() => {
			emit({
				event_id: 3,
				event_type: "extraction.completed",
				event_data: null,
				created_at: null,
			});
		});

		await waitFor(() => {
			expect(spy).toHaveBeenCalledWith({ queryKey: ["documents", "case-9"] });
			expect(spy).toHaveBeenCalledWith({ queryKey: ["extractions", "case-9"] });
		});
	});

	it("throws when used outside a CaseEventsProvider", () => {
		expect(() =>
			renderHook(() => useCaseEvents(), {
				wrapper: ({ children }) => (
					<QueryClientProvider client={new QueryClient()}>
						<OperatorProvider bearerToken="t">{children}</OperatorProvider>
					</QueryClientProvider>
				),
			}),
		).toThrow(/useCaseEvents must be used within <CaseEventsProvider>/);
	});
});
