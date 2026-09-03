import type { PosPortal, PosPortalCase } from "@multiversal-ventures/lux-core";
import { Check, ChevronDown, ChevronRight, Copy, Mail, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { type ResendOutcome, usePosPortalCases } from "./usePosPortalCases.js";
import { usePosPortals } from "./usePosPortals.js";

/** How long a Copy button reads "Copied" before returning to its resting label.
 * Exported so a test waits on the real window instead of restating the number. */
export const LINK_COPIED_RESET_MS = 1500;

export interface BorrowerLinksModalProps {
	onClose: () => void;
	/** Opens the publish-a-link dialog. Optional: a host that has not wired one
	 * renders no button, rather than a button that does nothing. */
	onNewLink?: () => void;
}

/**
 * Manage published borrower links — and reach the applications they produced.
 *
 * ## Where this lives, and why it is not part of the create dialog
 *
 * `NewBorrowerExperienceModal` is a two-field form with a one-shot result: it
 * shows the URL of the link just minted and nothing else. Hanging a list off it
 * would mean an operator who wants to look something up must first start
 * creating something they do not want. So this is a sibling surface, opened by
 * its own control, and the create dialog is untouched.
 *
 * ## Why there is no `open` prop
 *
 * Unlike the create dialog, this component's existence IS its openness. That is
 * deliberate rather than inconsistent: it calls `usePosPortals()`, whose query
 * has no `enabled` gate, so an `open={false}` render that returned `null` would
 * still fire `GET /api/pos-portals` — React hooks cannot be skipped. Making
 * mounting the only way to open it puts the fetch gate somewhere a caller
 * cannot get wrong. Hosts render `{open && <BorrowerLinksModal … />}`.
 *
 * The same reasoning one level down: a link's applications are fetched only for
 * the row the operator expands ({@link LinkApplications} is mounted per
 * expansion, and `usePosPortalCases(null)` fetches nothing), so opening this
 * surface costs exactly one request no matter how many links a tenant has.
 */
export function BorrowerLinksModal({ onClose, onNewLink }: BorrowerLinksModalProps) {
	const { portals, loading, error, deactivate } = usePosPortals();
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const dialogRef = useRef<HTMLDialogElement>(null);

	// Mounting this component IS opening it (see the class docstring), so the
	// native dialog opens once, on mount — `showModal()` is what gives it a
	// real modal accessibility tree entry, browser-managed focus trap, and
	// Escape-to-dismiss, none of which a plain `role="dialog"` div provides.
	//
	// The backdrop click-to-close also lives here rather than as an `onClick`
	// prop on the `<dialog>`: a synthetic click handler on a non-interactive
	// element would need a paired key handler to satisfy a11y lint, but that
	// handler would be theater — the dialog is already keyboard-dismissable
	// natively (Escape → `close`, handled below), so there is no missing
	// keyboard path to add.
	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		if (!dialog.open) dialog.showModal();
		const handleClose = () => onClose();
		const handleBackdropClick = (e: MouseEvent) => {
			// Only a click that lands on the dialog's own box (i.e. the padded
			// area, not a descendant) counts as "outside the card".
			if (e.target === dialog) onClose();
		};
		dialog.addEventListener("close", handleClose);
		dialog.addEventListener("click", handleBackdropClick);
		return () => {
			dialog.removeEventListener("close", handleClose);
			dialog.removeEventListener("click", handleBackdropClick);
		};
	}, [onClose]);

	async function disable(portal: PosPortal) {
		setBusyId(portal.pos_portal_id);
		setActionError(null);
		try {
			await deactivate(portal.pos_portal_id);
		} catch (e) {
			setActionError(e instanceof Error ? e.message : "Could not disable the link.");
		} finally {
			setBusyId(null);
		}
	}

	return (
		// ## Why these classes and not the wrapper's
		//
		// A `showModal()`ed dialog is NOT a full-viewport wrapper that happens to
		// contain a card — it IS the card. The UA gives `dialog:modal`
		// `position: fixed; inset: 0; width/height: fit-content; margin: auto`,
		// and it is that `margin: auto` against `inset: 0` that centres it.
		// Tailwind's preflight resets `margin: 0` on `*`, so `m-auto` has to put
		// the centring back explicitly; without it the box is over-constrained,
		// `right`/`bottom` are dropped, and it pins to the top-left corner.
		//
		// For the same reason the dim is a `backdrop:` utility and not a
		// translucent background on the element: the dialog's own box is the
		// card, so a translucent black there tints the card, not the page. `::backdrop` is the only surface
		// that paints behind a top-layer element. The colour is written as a
		// literal rather than the palette-with-opacity form because Tailwind v4
		// compiles that to `color-mix(… var(--color-black) …)`, and
		// `::backdrop` inheriting custom properties from its originating element
		// is a recent change — a literal renders the same everywhere.
		//
		// `p-0` (not padding on the dialog) matters for dismissal, not looks:
		// backdrop-click-to-close keys on `e.target === dialog`, and any padding
		// would make a click just inside the card's edge land on the dialog box
		// itself and close it.
		<dialog
			ref={dialogRef}
			className="m-auto flex max-h-[85vh] w-[calc(100%-2rem)] max-w-3xl flex-col overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-xl backdrop:bg-[rgb(0_0_0/0.5)]"
			aria-label="Borrower links"
		>
			<div className="flex flex-none items-center justify-between px-5 pt-5 pb-3">
				<h2 className="text-base font-semibold text-slate-900">Borrower links</h2>
				<div className="flex items-center gap-2">
					{onNewLink ? (
						<button
							type="button"
							onClick={onNewLink}
							className="rounded-full bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
						>
							New link
						</button>
					) : null}
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
					>
						<X size={18} />
					</button>
				</div>
			</div>

			{/* The list is the only part that grows without bound, so it — not the
			    dialog — is what scrolls. `min-h-0` is load-bearing: a flex child's
			    default `min-height: auto` refuses to shrink below its content, so
			    without it `overflow-y-auto` never has an overflow to act on and the
			    dialog grows past `max-h-[85vh]` instead. */}
			<div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
				{actionError ? (
					<p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
						{actionError}
					</p>
				) : null}
				{error ? (
					<p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
						{error.message}
					</p>
				) : null}

				{loading ? (
					<p className="py-6 text-center text-sm text-slate-500">Loading your links…</p>
				) : portals.length === 0 ? (
					<p className="py-6 text-center text-sm text-slate-500">
						You have not published any borrower links yet.
					</p>
				) : (
					<ul className="divide-y divide-slate-100">
						{portals.map((portal) => (
							<LinkRow
								key={portal.pos_portal_id}
								portal={portal}
								expanded={expandedId === portal.pos_portal_id}
								onToggle={() =>
									setExpandedId((cur) =>
										cur === portal.pos_portal_id ? null : portal.pos_portal_id,
									)
								}
								busy={busyId === portal.pos_portal_id}
								onDisable={() => void disable(portal)}
							/>
						))}
					</ul>
				)}
			</div>
		</dialog>
	);
}

function LinkRow({
	portal,
	expanded,
	onToggle,
	busy,
	onDisable,
}: {
	portal: PosPortal;
	expanded: boolean;
	onToggle: () => void;
	busy: boolean;
	onDisable: () => void;
}) {
	const [copied, setCopied] = useState(false);

	// `expires_at` is the second of the three conditions `pos_repo.is_usable`
	// gates a link on, and the server already sends it — reading `active` alone
	// would badge an expired link "Active" and let an operator hand out a URL
	// that refuses every applicant. The THIRD condition (the product still
	// being enabled for this tenant) is deliberately NOT mirrored here: the
	// client is never told it, and guessing would be worse than a badge that
	// answers only what this row can actually see.
	const expired =
		portal.expires_at != null ? new Date(portal.expires_at).getTime() <= Date.now() : false;
	const openForBusiness = portal.active && !expired;

	// "Copied" is transient feedback, not a mode. Self-cleaning so an unmount
	// mid-window clears the timer.
	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), LINK_COPIED_RESET_MS);
		return () => clearTimeout(timer);
	}, [copied]);

	return (
		<li className="py-3">
			<div className="flex items-start gap-3">
				<button
					type="button"
					onClick={onToggle}
					aria-expanded={expanded}
					className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
					aria-label={`${expanded ? "Hide" : "Show"} applications for ${portal.label}`}
				>
					{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
				</button>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						{/* The whole point of Task 1: the name the operator typed, read
						    back to them. Until this rendered, `pos_portals.label` had no
						    reader in any UI. */}
						<span className="truncate text-sm font-medium text-slate-900">{portal.label}</span>
						<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
							{portal.product_id}
						</span>
						<span
							className={
								openForBusiness
									? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
									: "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
							}
						>
							{portal.active ? (expired ? "Expired" : "Active") : "Disabled"}
						</span>
					</div>
					<div className="mt-1.5 flex items-center gap-2">
						<input
							readOnly
							value={portal.url}
							aria-label={`Application link for ${portal.label}`}
							className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
						/>
						<button
							type="button"
							onClick={() =>
								void navigator.clipboard
									?.writeText(portal.url)
									.then(() => setCopied(true))
									.catch(() => setCopied(false))
							}
							className="inline-flex flex-none items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
						>
							{copied ? <Check size={13} /> : <Copy size={13} />}
							{copied ? "Copied" : "Copy link"}
						</button>
					</div>
					<p className="mt-1 text-xs text-slate-500">
						{portal.slug}
						{portal.created_at ? ` · created ${formatDate(portal.created_at)}` : ""}
					</p>
				</div>
				{portal.active ? (
					<button
						type="button"
						onClick={onDisable}
						disabled={busy}
						className="flex-none rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
					>
						{busy ? "Disabling…" : "Disable"}
					</button>
				) : null}
			</div>

			{/* Mounted only while expanded — that mount IS the fetch gate for this
			    link's applications. */}
			{expanded ? <LinkApplications posPortalId={portal.pos_portal_id} /> : null}
		</li>
	);
}

function LinkApplications({ posPortalId }: { posPortalId: string }) {
	const { cases, loading, error, resend } = usePosPortalCases(posPortalId);

	if (loading) {
		return <p className="mt-3 pl-9 text-xs text-slate-500">Loading applications…</p>;
	}
	if (error) {
		return (
			<p role="alert" className="mt-3 pl-9 text-xs text-red-700">
				{error.message}
			</p>
		);
	}
	if (cases.length === 0) {
		return (
			<p className="mt-3 pl-9 text-xs text-slate-500">
				Nobody has started an application from this link yet.
			</p>
		);
	}
	return (
		<ul className="mt-3 space-y-2 pl-9">
			{cases.map((c) => (
				<ApplicationRow key={c.case_id} application={c} resend={resend} />
			))}
		</ul>
	);
}

/**
 * How each case state reads to an operator on THIS surface.
 *
 * Scoped to the states a POS application can be in before it becomes ordinary
 * queue work; anything else falls through to the raw state with its underscores
 * removed, so a state introduced by a workflow tomorrow renders legibly instead
 * of blank. Deliberately not a shared label map: `awaiting_verification` means
 * "we mailed them a code and they have not entered it", which is only worth
 * saying where a resend button sits beside it.
 */
const STATE_LABELS: Record<string, string> = {
	awaiting_verification: "Code not entered yet",
	awaiting_documents: "Verified — awaiting documents",
};

function stateLabel(state: string): string {
	return STATE_LABELS[state] ?? state.replace(/_/g, " ");
}

function formatDate(iso: string): string {
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

function ApplicationRow({
	application,
	resend,
}: {
	application: PosPortalCase;
	resend: (caseId: string, partyId: string) => Promise<ResendOutcome>;
}) {
	const [outcome, setOutcome] = useState<ResendOutcome | null>(null);
	const [busyPartyId, setBusyPartyId] = useState<string | null>(null);
	// Which party the notice below belongs to, kept separately from `busyPartyId`
	// because that one is cleared the moment the request settles — and "Try
	// again" is only offered AFTER it settles. Retrying off `busyPartyId` would
	// therefore always resend to the first party in the list, which on a
	// multi-party case is the wrong borrower's inbox.
	const [lastPartyId, setLastPartyId] = useState<string | null>(null);

	async function send(partyId: string) {
		setBusyPartyId(partyId);
		setLastPartyId(partyId);
		setOutcome(null);
		setOutcome(await resend(application.case_id, partyId));
		setBusyPartyId(null);
	}

	// An unverified applicant has typed an email into a public form and nothing
	// else: no name, no property, and `cases.name` stays null until the case
	// reaches scenario naming. So the address is the row's identity — rendering
	// "Untitled Case" here would name every row identically.
	const parties = application.parties ?? [];
	const heading = application.name ?? parties[0]?.email ?? "Application";

	return (
		<li className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
			<div className="flex flex-wrap items-center gap-2">
				<span className="truncate text-xs font-medium text-slate-800">{heading}</span>
				<span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600">
					{stateLabel(application.state)}
				</span>
				{application.created_at ? (
					<span className="text-[11px] text-slate-500">
						started {formatDate(application.created_at)}
					</span>
				) : null}
			</div>

			{parties.length === 0 ? (
				<p className="mt-1 text-[11px] text-slate-500">
					No contact on file — nothing to re-send to.
				</p>
			) : (
				<ul className="mt-1.5 space-y-1">
					{parties.map((p) => (
						<li key={p.party_id} className="flex items-center justify-between gap-2">
							<span className="truncate text-xs text-slate-600">
								{p.display_name ?? p.email ?? "Unnamed applicant"}
							</span>
							<button
								type="button"
								disabled={busyPartyId === p.party_id || !p.email}
								onClick={() => void send(p.party_id)}
								title={
									p.email
										? `Re-send the access code to ${p.email}`
										: "No email address on file for this applicant"
								}
								className="inline-flex flex-none items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
							>
								<Mail size={12} />
								{busyPartyId === p.party_id ? "Sending…" : "Resend code"}
							</button>
						</li>
					))}
				</ul>
			)}

			{outcome && lastPartyId ? (
				<ResendNotice outcome={outcome} onRetry={() => void send(lastPartyId)} />
			) : null}
		</li>
	);
}

/**
 * The result of a resend, with the behaviour its status calls for.
 *
 * The SENTENCE is always the server's — it composes an operator-actionable
 * remedy per refusal, and restating those here would put the same prose in two
 * repositories. What this adds is the difference between them: whether the
 * operator should retry, wait, act on the remedy, or accept that the row is
 * gone. Collapsing all four into "something went wrong" is exactly what the
 * distinct statuses exist to prevent.
 */
function ResendNotice({
	outcome,
	onRetry,
}: {
	outcome: ResendOutcome;
	onRetry: () => void;
}) {
	if (outcome.kind === "sent") {
		// `<output>` carries an implicit `status` role — same accessible
		// announcement as the `role="status"` it replaces, native rather than
		// bolted on. `block` restores the box behaviour the surrounding
		// rounded/padded classes assume; `output` is inline by default.
		return (
			<output className="mt-2 block rounded bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800">
				{outcome.message}
			</output>
		);
	}
	// The follow-up line differs per kind, and it is the part the status code
	// carries that the sentence does not.
	const followUp =
		outcome.kind === "gone"
			? "This application no longer exists — the list has been refreshed."
			: outcome.kind === "refused"
				? "Nothing was sent. Follow the step above, then try again."
				: outcome.kind === "throttled"
					? "Nothing was sent. This will work again shortly."
					: "It may not have been sent. Retrying now is safe.";
	return (
		<div role="alert" className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
			<p>{outcome.message}</p>
			<p className="mt-0.5 text-amber-800">{followUp}</p>
			{outcome.kind === "undelivered" || outcome.kind === "throttled" ? (
				<button
					type="button"
					onClick={onRetry}
					className="mt-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
				>
					Try again
				</button>
			) : null}
		</div>
	);
}
