import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";
import type { CaseEvent, OperatorClient } from "@multiversal-ventures/lux-core";
import { OperatorProvider } from "../providers/OperatorProvider.js";
import { CaseEventsProvider } from "../providers/CaseEventsProvider.js";
import { useQualification } from "./useQualification.js";

const FakeClientContext = createContext<OperatorClient | null>(null);
vi.mock("../providers/OperatorProvider", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../providers/OperatorProvider")>();
	return {
		...actual,
		useOperatorClient: () => {
			const fake = useContext(FakeClientContext);
			if (!fake) throw new Error("test: fake client missing");
			return fake;
		},
		useOperatorClientOptional: () => useContext(FakeClientContext),
	};
});

function build(onStream: (cb: (e: CaseEvent) => void) => () => void): OperatorClient {
	return {
		getEvents: vi.fn().mockResolvedValue({ data: [], error: null }),
		streamEventsParsed: vi.fn().mockImplementation((_cid: string, cb: (e: CaseEvent) => void) => ({
			abort: onStream(cb),
		})),
		qualifyCase: vi.fn().mockResolvedValue({ data: { workflow_id: "wf-1" }, error: null }),
	} as unknown as OperatorClient;
}

function makeWrapper(client: OperatorClient, caseId: string) {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={qc}>
			<OperatorProvider bearerToken="t" queryClient={qc}>
				<FakeClientContext.Provider value={client}>
					<CaseEventsProvider caseId={caseId}>{children}</CaseEventsProvider>
				</FakeClientContext.Provider>
			</OperatorProvider>
		</QueryClientProvider>
	);
}

describe("useQualification", () => {
	it("prefers the custom product on qualify.completed (UI bug regression)", async () => {
		let emit: (e: CaseEvent) => void = () => {};
		const client = build((cb) => {
			emit = cb;
			return () => {};
		});
		const { result } = renderHook(() => useQualification("c", "s"), {
			wrapper: makeWrapper(client, "c"),
		});

		await act(async () => {
			await result.current.run();
		});

		act(() => {
			emit({
				event_id: 10,
				event_type: "qualify.completed",
				created_at: null,
				event_data: {
					products: [
						{ product: "fannie_mae", specs_run: 3, total_monthly: 7538 },
						{ product: "custom", specs_run: 1, total_monthly: 2075 },
					],
				},
			});
		});

		await waitFor(() => {
			expect(result.current.state).toBe("complete");
			expect(result.current.result?.product).toBe("custom");
			expect(result.current.result?.total_monthly).toBe(2075);
		});
	});

	it("sets state=error when qualifyCase call fails", async () => {
		const client = build(() => () => {});
		(client.qualifyCase as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: null,
			error: { status: 500, message: "boom" },
		});
		const { result } = renderHook(() => useQualification("c", "s"), {
			wrapper: makeWrapper(client, "c"),
		});
		await act(async () => {
			await result.current.run();
		});
		await waitFor(() => expect(result.current.state).toBe("error"));
		expect(result.current.error).toBe("boom");
	});

	it("reset returns state to idle and clears result", async () => {
		let emit: (e: CaseEvent) => void = () => {};
		const client = build((cb) => {
			emit = cb;
			return () => {};
		});
		const { result } = renderHook(() => useQualification("c", "s"), {
			wrapper: makeWrapper(client, "c"),
		});
		await act(async () => {
			await result.current.run();
		});
		act(() => {
			emit({
				event_id: 1,
				event_type: "qualify.completed",
				created_at: null,
				event_data: { products: [{ product: "custom", specs_run: 1, total_monthly: 5 }] },
			});
		});
		await waitFor(() => expect(result.current.state).toBe("complete"));
		act(() => {
			result.current.reset();
		});
		expect(result.current.state).toBe("idle");
		expect(result.current.result).toBeNull();
	});
});
