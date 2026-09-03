import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The seam: `usePosPortals().create` wired straight into the modal's `onCreate`.
 *
 * Everywhere else the two halves are tested apart — the modal stubs `onCreate`
 * with `vi.fn()`, the hook mocks the client — so nothing exercises the shape
 * they hand each other. Task 12 ships no call site, so this harness stands in
 * for one until Task 13 writes the real one in gunnr.
 *
 * This is a RUNTIME check only: `packages/react/tsconfig.json` excludes
 * `*.test.tsx` from typecheck, so nothing here proves the two types are
 * assignable at compile time. That check lands with Task 13's call site.
 */

const PORTAL = {
	pos_portal_id: "pp-1",
	product_id: "dscr",
	slug: "abc123def456",
	label: "DSCR — my website",
	url: "/apply/abc123def456",
	active: true,
	expires_at: null,
	created_at: "2026-08-25T00:00:00Z",
};

const listPosPortals = vi.fn(async () => [] as (typeof PORTAL)[]);
const createPosPortal = vi.fn(async () => PORTAL);
const deactivatePosPortal = vi.fn(async () => ({ ...PORTAL, active: false }));

vi.mock("@multiversal-ventures/lux-core", () => ({
	getDefaultClient: () => ({ listPosPortals, createPosPortal, deactivatePosPortal }),
}));

// Imported after the mock so the hook picks up the mocked client.
const { usePosPortals } = await import("./usePosPortals");
const { NewBorrowerExperienceModal } = await import("./NewBorrowerExperienceModal");

const products = [{ product_id: "dscr", display_label: "DSCR" }];

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** The composition Task 13 will write: the hook's `create` as the modal's
 * `onCreate`, with no adapter in between. */
function Harness({ onClose }: { onClose: () => void }) {
	const { create } = usePosPortals();
	return (
		<NewBorrowerExperienceModal open onClose={onClose} products={products} onCreate={create} />
	);
}

beforeEach(() => {
	queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	listPosPortals.mockReset();
	listPosPortals.mockResolvedValue([]);
	createPosPortal.mockReset();
	createPosPortal.mockResolvedValue(PORTAL);
	deactivatePosPortal.mockReset();
	deactivatePosPortal.mockResolvedValue({ ...PORTAL, active: false });
});

describe("usePosPortals composed into NewBorrowerExperienceModal", () => {
	it("carries the operator's input to the client and the client's URL back to the screen", async () => {
		render(<Harness onClose={() => {}} />, { wrapper });

		await userEvent.type(screen.getByLabelText(/name/i), "DSCR — my website");
		await userEvent.click(screen.getByRole("button", { name: /create link/i }));

		// The modal's payload keys reach the client unchanged...
		await waitFor(() =>
			expect(createPosPortal).toHaveBeenCalledWith({
				product_id: "dscr",
				label: "DSCR — my website",
			}),
		);
		// ...and the server's `url` — site-relative here, which is the shape a
		// deployment with no public base URL returns — is what gets displayed.
		await waitFor(() => expect(screen.getByLabelText(/application link/i)).toHaveValue(PORTAL.url));
	});

	it("lets a client rejection reach the modal's error banner", async () => {
		// `mutateAsync` rejects; `mutate` would not, and the modal's catch would
		// never run — it would sit on a form that silently did nothing.
		createPosPortal.mockRejectedValue(new Error("Unknown or disabled product: dscr"));
		const onClose = vi.fn();
		render(<Harness onClose={onClose} />, { wrapper });

		await userEvent.type(screen.getByLabelText(/name/i), "doomed");
		await userEvent.click(screen.getByRole("button", { name: /create link/i }));

		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/unknown/i));
		expect(onClose).not.toHaveBeenCalled();
		// Not stuck busy: the operator can fix the input and retry.
		expect(screen.getByRole("button", { name: /create link/i })).toBeEnabled();
	});
});
