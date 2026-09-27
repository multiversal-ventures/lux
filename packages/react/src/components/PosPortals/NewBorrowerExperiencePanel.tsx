import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { PosPortal } from "@multiversal-ventures/lux-core";

/** One selectable product, in the wire shape `GET /api/products` returns. */
export interface PosProductOption {
	product_id: string;
	display_label: string;
}

/** How long the Copy button reads "Copied" before returning to its resting
 * label. Exported so a test can wait on the real window instead of restating
 * the number. */
export const COPIED_RESET_MS = 1500;

/**
 * How long the dialog waits for `onCreate` before it gives up. Exported so a
 * test drives the real value instead of restating it.
 *
 * **Why a deadline exists at all.** `busy` is cleared only by `onCreate`
 * settling, and nothing bounds that: `VeritasClient.requestJson` does spread its
 * `RequestInit` into `fetch`, so it *can* carry a `signal`, but no caller
 * supplies one and there is no default deadline. Without this, a request that
 * never settles leaves {@link requestClose} — and the equivalent guard on the
 * dialog's native `cancel` event — refusing every dismissal route forever: no
 * backdrop, no X, no Cancel, no Escape. The operator's only exit is a page
 * reload.
 *
 * **Which failure is worse, and for whom.** Both outcomes are bad for the
 * operator, and they are not close. An orphaned portal is inert: it is a row
 * nobody holds a URL for, `listPosPortals` still returns it, and the cost is one
 * repeated create. A trapped dialog costs them the whole page — the reload takes
 * every other piece of in-page state with it. And the decisive part: **that
 * forced reload produces exactly the orphan the guard exists to prevent.** Past
 * a hung request the guard is protecting nothing; it is only making the exit
 * more expensive. So bounding the wait gives up nothing the reload had not
 * already given up.
 *
 * **What this deliberately does not do.** It does not weaken the guard.
 * `requestClose` still refuses every operator dismissal for as long as the
 * create is genuinely in flight, which is the whole of every real request — the
 * fix this replaces is intact, not traded away. Nor does it abort the request:
 * the POST may already have minted the portal server-side and no client-side
 * abort can un-mint it, so threading a signal down through `createPosPortal`
 * and the `onCreate` prop would buy a fetch teardown and zero reduction in the
 * orphan it is supposed to address.
 *
 * 15s: longer than any create that is going to succeed, short enough that a
 * black-holed request does not read as a frozen app.
 */
export const CREATE_DEADLINE_MS = 15_000;

/** Shown when {@link CREATE_DEADLINE_MS} elapses. It says "may" because that is
 * all this client knows: the request was abandoned, not cancelled, and the
 * server may well have committed the portal. There is no surface in this package
 * that lists a tenant's links, so it cannot tell the operator to go and look. */
const DEADLINE_MESSAGE =
	"The server did not answer in time. A link may already have been created — it will not be shown here, so trying again may leave a duplicate.";

export interface NewBorrowerExperiencePanelProps {
	/** Dismiss. Called only by the Cancel button here; every other dismissal
	 * route belongs to the host's dialog, which is why {@link
	 * NewBorrowerExperiencePanelProps.onBusyChange} exists. */
	onClose: () => void;
	/** Raised whenever a create starts or settles. The host holds the dialog, so
	 * the host is the only place that can refuse Escape, an outside click and the
	 * dialog's own close control while a create is in flight — see the
	 * `requestClose` docstring for why that refusal exists and why it is
	 * bounded. */
	onBusyChange?: (busy: boolean) => void;
	/** Extra classes for the scroll container, e.g. a host-chosen max height. */
	className?: string;
	/** The products this tenant may publish a link for. The caller supplies the
	 * list — this component never hardcodes or filters products. */
	products: PosProductOption[];
	/** Publishes the link. `usePosPortals().create` satisfies this; a `PosPortal`
	 * is assignable to the narrower `{slug, url}` the modal actually reads. */
	onCreate: (input: { product_id: string; label: string }) => Promise<
		Pick<PosPortal, "slug" | "url">
	>;
}

/**
 * Publish a borrower intake link.
 *
 * Two fields, because that is the whole configuration: which product the
 * application runs under, and a name so the loan officer can tell their links
 * apart. Both are required by the server (`POST /api/pos-portals` 400s on a
 * blank label), so the blank-label check here is a courtesy that saves a
 * round-trip — the server remains the authority.
 *
 * The slug is never a client input: the server mints it, and the returned
 * `url` is displayed verbatim rather than composed here, because it is
 * site-relative when the deployment has no public base URL configured.
 */
export function NewBorrowerExperiencePanel({
	onClose,
	onBusyChange,
	className,
	products,
	onCreate,
}: NewBorrowerExperiencePanelProps) {
	const [label, setLabel] = useState("");
	const [productId, setProductId] = useState("");
	const [created, setCreated] = useState<Pick<PosPortal, "slug" | "url"> | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [labelError, setLabelError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	// Mirrored out on every transition rather than read back in: the host needs
	// it to hold its dialog shut mid-create, and a prop would make two sources of
	// truth for a flag this component alone sets.
	useEffect(() => {
		onBusyChange?.(busy);
	}, [busy, onBusyChange]);
	const [copied, setCopied] = useState(false);

	// The create deadline's timer, on a ref rather than only in `submit`'s closure
	// so that unmount can clear it. `submit`'s `finally` covers both settled paths,
	// but it does not run at all while the create is still in flight: a parent that
	// unmounts the dialog mid-flight would otherwise leave the deadline timer
	// alive to reject into `setError`/`setBusy` on a component that no longer
	// exists. React 18 no-ops those updates and warns
	// about nothing, which is precisely why the leak would never surface on its own.
	const deadlineRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	useEffect(() => {
		return () => {
			if (deadlineRef.current) clearTimeout(deadlineRef.current);
		};
	}, []);

	// No reopen-reset effect: the host mounts this only while its dialog is open,
	// so every open is a fresh mount and therefore a fresh form. A component that
	// survived a close would show the previous link's URL on the next open, which
	// reads as "you already made this one".

	// "Copied" is transient feedback, not a mode: without this the button reads
	// "Copied" for the rest of the dialog's life and a second copy looks like a
	// no-op. Self-cleaning, so an unmount mid-window clears the timer.
	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), COPIED_RESET_MS);
		return () => clearTimeout(timer);
	}, [copied]);

	// Derived rather than stored, so a products list that arrives after mount
	// still selects something instead of submitting an empty product_id. It is
	// still "" when the list is empty — an empty list and a list that has not
	// arrived yet are the same thing from in here — and submit is disabled on
	// that, rather than POSTing `product_id: ""` for the server to reject.
	const selectedProductId = productId || products[0]?.product_id || "";

	async function submit() {
		if (!label.trim()) {
			setLabelError("Name this link so you can find it later.");
			return;
		}
		setLabelError(null);
		setError(null);
		setBusy(true);
		// The deadline races the caller's promise rather than aborting it, so it
		// bounds `busy` whatever `onCreate` turns out to be — this prop takes any
		// promise, not only the client's. Cleared in `finally` for the ordinary
		// case, where the create settles first and the timer would otherwise
		// outlive it, and on unmount by the effect above for the case where the
		// race never settles at all.
		try {
			const portal = await Promise.race([
				onCreate({ product_id: selectedProductId, label: label.trim() }),
				new Promise<never>((_resolve, reject) => {
					deadlineRef.current = setTimeout(
						() => reject(new Error(DEADLINE_MESSAGE)),
						CREATE_DEADLINE_MS,
					);
				}),
			]);
			setCreated({ slug: portal.slug, url: portal.url });
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not create the link.");
		} finally {
			if (deadlineRef.current) clearTimeout(deadlineRef.current);
			deadlineRef.current = undefined;
			setBusy(false);
		}
	}

	/**
	 * Dismissal, refused while a create is in flight.
	 *
	 * The POST may already have minted the portal server-side, and this dialog is
	 * the only place this package ever displays the returned `url`; no surface
	 * here lists a tenant's existing links, so closing mid-flight strands one.
	 * The link itself is not lost — `listPosPortals` still returns it — but
	 * recovering it needs a list UI that nobody owns yet.
	 *
	 * This covers the Cancel button, the only dismissal route this panel owns.
	 * Escape, an outside click and the dialog's own close control belong to the
	 * host's dialog, which refuses them off `onBusyChange` — see
	 * gunnr's `PosPortalDialog`. A host that ignores `onBusyChange`, or that
	 * unmounts the panel outright, still drops the result; this component cannot
	 * refuse that.
	 *
	 * The guard is bounded, and that bound is the only thing standing between it
	 * and a dialog nothing can dismiss: `busy` is released by
	 * {@link CREATE_DEADLINE_MS} even when `onCreate` never settles, which is
	 * where the reasoning for that trade is written. Refusal here therefore has a
	 * ceiling; it is not "until the operator reloads".
	 */
	function requestClose() {
		if (busy) return;
		onClose();
	}

	function copy(url: string) {
		void navigator.clipboard
			?.writeText(url)
			.then(() => setCopied(true))
			.catch(() => setCopied(false));
	}

	return (
		<div className={className ? `overflow-y-auto ${className}` : "overflow-y-auto"}>
			{error ? (
				<p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
					{error}
				</p>
			) : null}

			{created ? (
				<div>
					<p className="text-sm text-slate-600">Share this link, or embed it on your site.</p>
					<div className="mt-3 flex items-center gap-2">
						<input
							readOnly
							value={created.url}
							aria-label="Application link"
							className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
						/>
						<button
							type="button"
							onClick={() => copy(created.url)}
							className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
						>
							{copied ? <Check size={15} /> : <Copy size={15} />}
							{copied ? "Copied" : "Copy link"}
						</button>
					</div>
					<div className="mt-4 flex justify-end">
						<button
							type="button"
							onClick={requestClose}
							className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
						>
							Done
						</button>
					</div>
				</div>
			) : (
				<div>
					<label htmlFor="pos-portal-label" className="block text-sm font-medium text-slate-700">
						Name
					</label>
					<input
						id="pos-portal-label"
						value={label}
						onChange={(e) => setLabel(e.target.value)}
						placeholder="DSCR — my website"
						aria-invalid={labelError ? true : undefined}
						aria-describedby={labelError ? "pos-portal-label-error" : undefined}
						className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
					/>
					{labelError ? (
						<p id="pos-portal-label-error" className="mt-1 text-xs text-red-600">
							{labelError}
						</p>
					) : null}

					<label
						htmlFor="pos-portal-product"
						className="mt-4 block text-sm font-medium text-slate-700"
					>
						Product
					</label>
					<select
						id="pos-portal-product"
						value={selectedProductId}
						onChange={(e) => setProductId(e.target.value)}
						className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
					>
						{products.map((p) => (
							<option key={p.product_id} value={p.product_id}>
								{p.display_label}
							</option>
						))}
					</select>

					<div className="mt-5 flex items-center justify-end gap-2">
						<button
							type="button"
							onClick={requestClose}
							disabled={busy}
							className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={() => void submit()}
							disabled={busy || !selectedProductId}
							className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
						>
							{busy ? "Creating…" : "Create link"}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
