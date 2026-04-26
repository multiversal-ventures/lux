import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OperatorProvider } from "../../providers/OperatorProvider";
import { DocumentPageImage } from "./DocumentPageImage";

function makeWrapper() {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return ({ children }: { children: React.ReactNode }) => (
		<QueryClientProvider client={qc}>
			<OperatorProvider bearerToken="t" queryClient={qc}>{children}</OperatorProvider>
		</QueryClientProvider>
	);
}

describe("DocumentPageImage", () => {
	beforeEach(() => {
		(globalThis.URL as unknown as { createObjectURL: () => string }).createObjectURL = () => "blob:z";
		(globalThis.URL as unknown as { revokeObjectURL: (s: string) => void }).revokeObjectURL = () => {};
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
			ok: true, blob: async () => new Blob(),
		} as unknown as Response));
	});
	afterEach(() => vi.restoreAllMocks());

	it("builds the pagePngUrl and renders an AuthedImage", async () => {
		const { container } = render(
			<DocumentPageImage caseId="c" fileId="f" pageNumber={3} />,
			{ wrapper: makeWrapper() },
		);
		await waitFor(() => {
			expect(container.querySelector("img")).not.toBeNull();
		});
		// Verify the page URL was hit.
		const called = vi.mocked(fetch).mock.calls[0][0] as string;
		expect(called).toContain("/api/cases/c/files/f/pages/3.png");
	});
});
