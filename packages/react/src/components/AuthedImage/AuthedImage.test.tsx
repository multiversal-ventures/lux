import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OperatorProvider } from "../../providers/OperatorProvider.js";
import { AuthedImage } from "./AuthedImage.js";

function makeWrapper() {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return ({ children }: { children: React.ReactNode }) => (
		<QueryClientProvider client={qc}>
			<OperatorProvider bearerToken="t" queryClient={qc}>{children}</OperatorProvider>
		</QueryClientProvider>
	);
}

describe("AuthedImage", () => {
	beforeEach(() => {
		(globalThis.URL as unknown as { createObjectURL: () => string }).createObjectURL = () => "blob:x";
		(globalThis.URL as unknown as { revokeObjectURL: (s: string) => void }).revokeObjectURL = () => {};
		vi.stubGlobal("fetch", vi.fn());
	});
	afterEach(() => vi.restoreAllMocks());

	it("renders an img with the blob URL", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			blob: async () => new Blob(),
		} as unknown as Response);
		const { getByRole } = render(
			<AuthedImage url="/api/p.png" alt="page" />,
			{ wrapper: makeWrapper() },
		);
		const img = await waitFor(() => getByRole("img", { name: "page" }));
		expect(img).toHaveAttribute("src", "blob:x");
	});

	it("renders nothing when url is null", () => {
		const { container } = render(<AuthedImage url={null} />, { wrapper: makeWrapper() });
		expect(container.querySelector("img")).toBeNull();
	});

	it("renders fallback on fetch error", async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: false,
			statusText: "Not Found",
			text: async () => "not found",
			status: 404,
		} as unknown as Response);
		const { findByText } = render(
			<AuthedImage url="/api/p.png" fallback={<div>missing</div>} />,
			{ wrapper: makeWrapper() },
		);
		await findByText("missing");
	});
});
