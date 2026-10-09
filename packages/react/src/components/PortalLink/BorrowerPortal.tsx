import { useEffect, useRef, useState } from "react";
import { Ban, Check, CheckCheck, FileText, Loader2, Lock, Mail, Paperclip, Pencil, Trash2, X } from "lucide-react";
import { usePortalSession } from "../../hooks/usePortalSession.js";
import { clockTime, isSameDay } from "../../timeAgo.js";
import { Avatar } from "../Avatar.js";
import { DateSeparator } from "../DateSeparator.js";
import { Checklist } from "../Checklist/index.js";
import { LoanStatusCard } from "../LoanStatus/index.js";
import { ApplicationStep } from "./ApplicationStep.js";
import type { components } from "@multiversal-ventures/lux-core";

type ThreadMessage = components["schemas"]["ThreadMessage"];

/** Where the applicant is in the flow. Named rather than numbered because the
 * numbers move: the application stage is present only when the case is scoped
 * to one product that still wants answers. */
type Stage = "verify" | "application" | "account" | "consent" | "hub";

// Must match the backend's ALLOWED_UPLOAD_EXTS (veritas files endpoint) — the
// picker's `accept` attr and the pre-upload check both derive from this.
const ACCEPTED_EXTS = [".pdf", ".png", ".jpg", ".jpeg", ".heic"];
const ACCEPT_ATTR = ACCEPTED_EXTS.join(",");

/** Subject line for a borrower-composed email to their case address. Static and
 * deliberately free of case detail: the address alone routes the mail (the
 * server resolves the case from the recipient), so nothing identifying needs to
 * ride in a header the borrower's mail provider will log. */
const INBOUND_SUBJECT = "Documents for my application";

/**
 * `mailto:` for the borrower's own case address, composed here rather than
 * server-side (the server supplies the address and nothing else).
 *
 * The address is interpolated verbatim: percent-encoding it would turn `@` into
 * `%40`, which not every mail client parses back into an addr-spec. It is a
 * server-minted `{case_id}-{hmac}@{domain}`, never borrower input.
 *
 * No `cc`. Veritas has no per-case loan-officer address — `officer_name` is a
 * display string and `Tenant.owner_email` is a billing contact — so any cc here
 * would be invented, and publishing an operator's mailbox to every borrower is
 * not a decision this component gets to make.
 */
function inboundMailtoHref(address: string): string {
	return `mailto:${address}?subject=${encodeURIComponent(INBOUND_SUBJECT)}`;
}

export interface BorrowerPortalProps {
	/** Portal token from the URL (`?token=…`), or null for an immediate error. */
	token: string | null;
	className?: string;
	/** Host hook to create a returnable account for the email (e.g. send a
	 * Firebase magic link). Called alongside storing the email server-side. */
	onCreateAccount?: (email: string) => Promise<void>;
	/** Wrong-credential upload fallback: return the signed-in operator/tenant's
	 * Bearer token so a portal-token upload that 401/403s (because this browser is
	 * also signed in to the app) can retry with a credential that authorizes the
	 * case. Omit for real borrowers. */
	operatorTokenFallback?: () => Promise<string | null>;
	/** Back to the borrower's own "My loans" dashboard. Given, the hub header
	 * offers the control; omitted, there is nothing to go back to (a one-off
	 * emailed link) and none is rendered. */
	onBack?: () => void;
}

/**
 * Borrower-facing portal, composed from lux pieces. A sequential flow —
 * **Identity (KBA) → E-sign + consent → Upload & submit** — each gate unlocking
 * the next. On submit the link is consumed (expires); the next visit shows
 * "link unavailable". No login; the token is the auth.
 */
export function BorrowerPortal({
	token,
	className,
	onCreateAccount,
	operatorTokenFallback,
	onBack,
}: BorrowerPortalProps) {
	const {
		session,
		loading,
		error,
		uploadError,
		clearUploadError,
		submitIntent,
		uploadDocuments,
		operatorTyping,
		sendTyping,
		loadMessagesBefore,
		previewForm,
	} = usePortalSession(token, { operatorTokenFallback });
	const fileRef = useRef<HTMLInputElement>(null);
	const lastTyped = useRef(0);
	// Auto-scroll the THREAD, never the page. Stick to the bottom only when the
	// borrower is already near it, so new officer messages don't yank them up
	// while they read history. First paint jumps instantly.
	//
	// `scrollTop` rather than a sentinel's `scrollIntoView`: the loan screen is
	// itself a scroll container now, and `scrollIntoView` walks ancestors — on
	// first paint it scrolled the whole page past the status card, which is the
	// one thing the borrower came to read.
	const scrollRef = useRef<HTMLDivElement>(null);
	const didInitialScroll = useRef(false);
	const [olderThread, setOlderThread] = useState<ThreadMessage[]>([]);
	const [olderHasMore, setOlderHasMore] = useState(false);
	const [loadingOlder, setLoadingOlder] = useState(false);
	const displayedThread = mergeThread(olderThread, session?.thread ?? []);
	const canLoadOlder =
		olderHasMore || (olderThread.length === 0 && !!session?.thread_has_more);
	const threadLen = displayedThread.length;
	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		const nearBottom = distanceFromBottom < 120;
		if (!didInitialScroll.current) {
			didInitialScroll.current = true;
			el.scrollTop = el.scrollHeight;
		} else if (nearBottom) {
			el.scrollTop = el.scrollHeight;
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [threadLen]);

	function onTyping() {
		const now = Date.now();
		if (now - lastTyped.current > 1500) {
			lastTyped.current = now;
			sendTyping();
		}
	}
	const [skippedAccount, setSkippedAccount] = useState(false);
	const [uploading, setUploading] = useState(false);
	// Client-side file-type rejection (no round-trip) — shown in the same
	// banner as server-side upload errors.
	const [pickError, setPickError] = useState<string | null>(null);
	const [finishing, setFinishing] = useState(false);
	const [replyText, setReplyText] = useState("");
	const [sendingReply, setSendingReply] = useState(false);
	// WhatsApp-style composer editing: the message_id loaded into the reply
	// composer for editing (null = compose a new reply). The pencil on a bubble
	// sets it; the send button flips Send → Save.
	const [editingId, setEditingId] = useState<string | null>(null);

	// Keeps the stepper from silently losing a chip mid-flow: once the form has
	// been shown, answering it empties `pending_inputs`, and without this the
	// remaining steps would renumber under the applicant.
	//
	// Declared HERE, above the `loading` / `!session` early returns, and not
	// beside the `needsInputs` it reads. Below them it is a CONDITIONAL hook:
	// the first render returns at `loading` having run 13 hooks, the next runs
	// 14, and React aborts the portal with error #310 ("rendered more hooks
	// than during the previous render"). The whole page is blank when that
	// happens. It is recomputed from `session` rather than from `needsInputs`
	// so it can live up here, where every hook in this component must.
	const sawApplicationInput =
		!!session?.verification?.verified && (session?.pending_inputs?.length ?? 0) > 0;
	const [sawApplication, setSawApplication] = useState(false);
	useEffect(() => {
		if (sawApplicationInput) setSawApplication(true);
	}, [sawApplicationInput]);

	useEffect(() => {
		setOlderThread([]);
		setOlderHasMore(false);
	}, [session?.session_id]);

	if (loading) {
		return <div className={wrap(className)}><p className="text-slate-500">Loading…</p></div>;
	}

	if (error || !session) {
		const msg = error?.message ?? "This link is invalid or has expired.";
		return (
			<div className={wrap(className)}>
				<div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
					<h2 className="font-semibold text-red-900 mb-1">Link unavailable</h2>
					<p className="text-sm text-red-700">{msg}</p>
					<p className="text-xs text-red-500 mt-2">Ask your loan officer to send a new link.</p>
				</div>
			</div>
		);
	}

	const name = session.entity?.name || "the borrower";

	const verified = session.verification.verified;
	// Advance past the account step only when the account is actually CLAIMED
	// (a Firebase uid is bound via claim-account, after the borrower clicks the
	// magic link and returns signed-in) — NOT when the email is merely submitted.
	const accountDone = !!session.has_account;
	const signed = session.signed;
	// `?? []` rather than a bare read: both fields are non-optional in the
	// current contract but absent entirely from any server predating them, and
	// this component is shipped to hosts that pin their own veritas version.
	const pendingInputs = session.pending_inputs ?? [];
	const requiredDocuments = session.required_documents ?? [];
	// The applicant's form is owed to them whenever the server still advertises
	// an unanswered create-time input. `pending_inputs` is already gated on
	// verification server-side (the pre-verify branch returns before it is
	// computed), so this can only be non-empty past the code screen — but the
	// `verified` conjunct is written out anyway, because "the gate is somewhere
	// else" is how a gate goes missing.
	const needsInputs = verified && pendingInputs.length > 0;
	const stage: Stage = !verified
		? "verify"
		: needsInputs
			? "application"
			: !accountDone && !skippedAccount
				? "account"
				: !signed
					? "consent"
					: "hub";
	// The flow is built, not hardcoded, because the application step exists only
	// for a case scoped to one product that still wants answers.
	const flow: { key: Stage; label: string }[] = [
		{ key: "verify", label: "Verify" },
		...(needsInputs || sawApplication
			? [{ key: "application" as Stage, label: "Application" }]
			: []),
		{ key: "account", label: "Account" },
		{ key: "consent", label: "Consent" },
	];
	const stepNumber = stage === "hub" ? flow.length + 1 : flow.findIndex((s) => s.key === stage) + 1;
	// The single binding both mail affordances below gate on AND interpolate, so
	// the gate and the rendered value cannot diverge. Trimmed because the gate is
	// a truthiness test: a whitespace-only value passes it and composes
	// `mailto:   ?subject=…`, the address-less compose window the empty-string
	// case exists to prevent. No deployment can send one — veritas builds this
	// field with `configured_inbound_address()`, which returns None unless
	// `inbound_domain()` (an `os.environ.get(...).strip()`) is non-blank, and the
	// local part is `{canonical uuid}-{hex tag}` — so this guards the property,
	// it does not fix an observed bug.
	const inboundAddress = session.inbound_email_address?.trim() || null;

	// ── What is outstanding: ONE count, three states ────────────────────────
	// `loan_status.action_count` is items across this party's OPEN requests
	// (veritas `open_item_count`). The header line, the card's action pill and
	// whether anything is asked for below all read it, so the three cannot
	// contradict each other — they used to, with the header counting open
	// request messages in the thread, the card reading the derived status, and
	// the document list rendering a request that was no longer open at all.
	//
	// `null`, not 0, when the server predates the field: a count of zero is a
	// claim ("nothing is outstanding") that such a server never made.
	const actionCount = session.loan_status ? (session.loan_status.action_count ?? 0) : null;
	const checklist = session.checklist ?? [];
	// `checklist` is the latest SENT `portal_requests` row for this party
	// (veritas `get_latest_sent_for_party`), and the two inputs measure DIFFERENT
	// things:
	//
	//   * `action_count` counts items on this party's open request MESSAGES, so
	//     an officer's ask — a published decision's conditions included — is in
	//     it, and drops out of it the moment that message is fulfilled.
	//   * The checklist row is also what `write_checklist` persists for a product
	//     whose documents the borrower has just resolved by answering the wizard.
	//     That path writes NO message (`api/portal/inputs.py`), so a genuinely
	//     outstanding product checklist comes with `action_count: 0`.
	//
	// So there are three states, and the difference between the first two is
	// exactly what the server did and did not claim:
	//
	//   * `asked` — a count above zero. Something IS open: the page may be
	//     imperative, and submit (which fulfils open messages, and nothing else)
	//     is offered once a file has been sent.
	//   * `requested` without `asked` — rows, no count. These documents were
	//     asked for; whether any are still owed is something no field says. The
	//     page lists them and offers the upload, in the past tense, and makes no
	//     claim either way. Hiding them because the server published no count
	//     would hide work a product genuinely requires; telling a borrower under
	//     review to "send these now" would be the old contradiction back again.
	//   * neither — said once, in one line, and the page stops.
	//
	// Every printed NUMBER comes from `action_count` alone, once, in the card's
	// action pill. Nothing anywhere says the borrower is done while a row shows.
	const requested = checklist.length > 0;
	const asked = (actionCount ?? 0) > 0;
	// Show the friendly "officer will reply" line when the borrower spoke last
	// (the most recent message is theirs) and the officer isn't mid-reply.
	const lastMsg = displayedThread[displayedThread.length - 1];
	const waitingForReply = !!lastMsg && lastMsg.author_kind === "borrower" && !operatorTyping;

	async function loadEarlierMessages() {
		const first = displayedThread[0];
		if (!first || loadingOlder) return;
		setLoadingOlder(true);
		try {
			const page = await loadMessagesBefore(first.created_at);
			if (page) {
				setOlderThread((prev) => mergeThread(page.thread, prev));
				setOlderHasMore(page.has_more);
			}
		} finally {
			setLoadingOlder(false);
		}
	}

	async function createAccount(email: string) {
		await submitIntent([{ type: "set_email", params: { email } }]);
		if (onCreateAccount) await onCreateAccount(email);
	}

	async function onFiles(files: FileList | null) {
		if (!files || files.length === 0) return;
		setPickError(null);
		clearUploadError();
		const all = Array.from(files);
		const accepted = all.filter((f) =>
			ACCEPTED_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext)),
		);
		const rejected = all.filter((f) => !accepted.includes(f));
		if (rejected.length > 0) {
			setPickError(
				`${rejected.map((f) => f.name).join(", ")} — unsupported file type. Accepted: PDF, PNG, JPG, HEIC.`,
			);
		}
		if (accepted.length > 0) {
			setUploading(true);
			await uploadDocuments(accepted);
			setUploading(false);
		}
		if (fileRef.current) fileRef.current.value = "";
	}

	async function submit() {
		setFinishing(true);
		await submitIntent([{ type: "submit", params: {} }]);
		setFinishing(false);
	}

	async function sendReply() {
		const t = replyText.trim();
		if (!t) return;
		setSendingReply(true);
		if (editingId) {
			await submitIntent([{ type: "edit_message", params: { message_id: editingId, text: t } }]);
			setEditingId(null);
		} else {
			await submitIntent([{ type: "reply", params: { text: t } }]);
		}
		setSendingReply(false);
		setReplyText("");
	}

	function startEdit(m: ThreadMessage) {
		setEditingId(m.message_id);
		setReplyText(m.body ?? "");
	}
	function cancelEdit() {
		setEditingId(null);
		setReplyText("");
	}

	// Every stage before "hub" is a gate (a centered card). "hub" is the
	// full-height chat.
	if (stage !== "hub") {
		return (
			<div className={wrap(className)}>
				<Stepper steps={flow.map((s) => s.label)} current={stepNumber} />
				{stage === "verify" ? (
					<CodeStep
						n={stepNumber}
						verified={session.verification.verified}
						onVerify={(code) => submitIntent([{ type: "verify", params: { code } }])}
					/>
				) : stage === "application" ? (
					<ApplicationStep
						fields={pendingInputs}
						documents={requiredDocuments}
						productLabel={session.product_display_label}
						stepNumber={stepNumber}
						onSubmitInputs={(inputs) => submitIntent([{ type: "set_inputs", params: { inputs } }])}
						onPreview={previewForm}
					/>
				) : stage === "account" ? (
					<AccountStep
						n={stepNumber}
						onSubmit={createAccount}
						onSkip={() => setSkippedAccount(true)}
						onSubmitWithoutHook={() => setSkippedAccount(true)}
						hasAccountHook={!!onCreateAccount}
						returning={!!session.account_email}
						initialEmail={session.account_email ?? ""}
					/>
				) : (
					<SignStep n={stepNumber} name={name} onSign={(signature) => submitIntent([{ type: "sign", params: { signature } }])} />
				)}
			</div>
		);
	}

	// Generic UI chrome, never domain copy: every status label, description,
	// term and document title on this page is server data read from the session.
	//
	// The header line prints no digit — the number belongs to the card's action
	// pill and appears exactly once, so the header cannot disagree with it by a
	// count or by a word. It states what the page below states, in the same
	// voice: an open ask, documents that were asked for, or nothing.
	const headerLine = asked
		? "Action needed"
		: requested
			? "Documents requested"
			: "Nothing needed from you right now";
	const nextStepLine = asked
		? requested
			? "Send us what's listed below and your loan officer takes it from there."
			: "Your loan officer is waiting on a document from you — upload it below."
		// Names no author: uncounted rows can be an officer's closed request, the
		// product's own generated checklist (which `write_checklist` writes with
		// no author at all) or the findings fallback — nobody asked for the last
		// two.
		: "These were requested for your loan. Send anything you haven't already.";

	return (
		<div
			className={`flex flex-col h-full mx-auto w-full max-w-2xl bg-slate-50 sm:border-x border-slate-200 ${className ?? ""}`}
		>
			<header className="shrink-0 px-4 py-3 border-b border-slate-200 bg-white flex items-start justify-between gap-3">
				<div className="min-w-0">
					<h1 className="font-semibold text-slate-900 truncate">
						{session.requested_by || "Your loan"}
					</h1>
					{/* The page's only count, from the only field that owns one. */}
					<p className="text-xs text-slate-500">{headerLine}</p>
				</div>
				{onBack && (
					<button
						type="button"
						onClick={onBack}
						className="shrink-0 text-sm font-medium text-blue-700 hover:text-blue-900 cursor-pointer transition-colors"
					>
						My loans
					</button>
				)}
			</header>

			{/* The page scrolls; the thread scrolls inside its own card. The status
			    card is the first thing in it and nothing auto-scrolls the page, so
			    the status, the next step and the start of the conversation are all
			    reachable without hunting. */}
			<div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-4">
				{/* THE HERO. Guarded because all three blocks are additive and
				    nullable — a server predating them renders the rest. */}
				{session.loan_status && (
					<div data-testid="loan-status-card">
						<LoanStatusCard
							status={session.loan_status}
							summary={session.loan_summary}
							decision={session.decision}
						/>
					</div>
				)}

				{/* THE ONE NEXT ACTION. One heading, one sentence, one button, and the
				    documents as a compact list under it — never four full-width
				    cards competing with the status above.
				    `required_documents` is deliberately absent: that is what the
				    product DECLARES and is rendered once, on the application step,
				    while this is what is actually outstanding against this party.
				    The moment a loan officer hand-authors a request the two
				    legitimately diverge, and showing both would show two asks. */}
				{asked || requested ? (
					<section className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 sm:p-6">
						<h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
							{asked ? "Next step" : "Requested documents"}
						</h2>
						<p className="mt-2 text-sm text-slate-700">{nextStepLine}</p>
						{/* The officer's own words about THIS ask, so it sits with the ask
						    and not in the idle state, where nothing was asked. */}
						{session.request_message && (
							<p className="mt-3 border-l-2 border-slate-200 pl-3 text-sm text-slate-600 whitespace-pre-line">
								{session.request_message}
							</p>
						)}
						{requested && <Checklist items={checklist} className="mt-3" />}
						<button
							type="button"
							onClick={() => fileRef.current?.click()}
							disabled={uploading}
							className="mt-4 w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 cursor-pointer transition-colors"
						>
							{uploading ? "Uploading…" : "Upload documents"}
						</button>
						{/* Submit marks this party's OPEN request messages fulfilled
						    (veritas `_handle_submit_intent`) — with nothing open it
						    fulfils nothing, so it is offered only where there is a count
						    to clear. */}
						{asked && session.uploaded_files.length > 0 && (
							<button
								type="button"
								onClick={submit}
								disabled={finishing}
								className="mt-2 w-full rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 text-sm font-medium py-2.5 cursor-pointer transition-colors"
							>
								{finishing ? "Submitting…" : "I've sent everything — submit"}
							</button>
						)}
					</section>
				) : (
					// Nothing is outstanding: said once, in one line, with no card
					// around it and nothing to press. A borrower with nothing to do
					// should see that and stop reading.
					<p className="px-1 text-sm text-slate-500">
						Nothing to do right now — your loan officer will message you here if they need anything.
					</p>
				)}

				{/* Upload feedback, whichever control started the upload — the
				    composer's paperclip calls the same handler as the button above. */}
				{(uploadError || pickError) && (
					<div className="flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
						<p className="text-xs text-red-700">{pickError ?? uploadError?.message}</p>
						<button
							type="button"
							aria-label="Dismiss upload error"
							onClick={() => {
								setPickError(null);
								clearUploadError();
							}}
							className="shrink-0 text-red-400 hover:text-red-600 cursor-pointer"
						>
							<X size={14} />
						</button>
					</div>
				)}

				{/* THE CONVERSATION, demoted: where the officer replies, not where
				    tasks live. Its own card, its own scroller, below the two things
				    the borrower actually came to read. */}
				<section className="bg-white rounded-lg border border-slate-200 shadow-sm">
					<div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
						<h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
							Messages
						</h2>
						{session.officer_name && (
							<span className="min-w-0 truncate text-xs text-slate-500">
								{session.officer_name}
							</span>
						)}
					</div>

					<div
						ref={scrollRef}
						data-testid="thread-scroll"
						className="max-h-[22rem] overflow-y-auto px-3 py-3 bg-slate-50"
					>
						{canLoadOlder && (
							<div className="mb-3 flex justify-center">
								<button
									type="button"
									onClick={loadEarlierMessages}
									disabled={loadingOlder}
									className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 hover:border-blue-300 hover:text-blue-700 disabled:opacity-60 cursor-pointer"
								>
									{loadingOlder ? "Loading earlier…" : "Load earlier messages"}
								</button>
							</div>
						)}
						{displayedThread.map((m, i) => {
							// Run grouping: a "run" is consecutive messages from the same
							// author. The "Your loan officer" label shows on the FIRST officer
							// bubble of a run; the avatar shows on the LAST bubble of a run
							// (a spacer keeps alignment on the others) — so a back-to-back
							// reply reads as one person speaking, not a wall of avatars.
							const prev = displayedThread[i - 1];
							const next = displayedThread[i + 1];
							const startsRun = !prev || prev.author_kind !== m.author_kind;
							const endsRun = !next || next.author_kind !== m.author_kind;
							const isOfficer = m.author_kind !== "borrower";
							// Date pill before the first message and at each calendar-day
							// boundary.
							const showDay = i === 0 || !isSameDay(prev.created_at, m.created_at);
							// Tight grouping: same-author runs hug (mt-0.5); a new speaker
							// or a day boundary gets clear separation (mt-3). First row flush.
							const rowGap = i === 0 ? "" : startsRun || showDay ? "mt-3" : "mt-0.5";
							return (
								<div key={m.message_id} className={rowGap}>
									{showDay && <DateSeparator iso={m.created_at} />}
									<Bubble
										m={m}
										showOfficerHeader={isOfficer && startsRun}
										showAvatar={endsRun}
										endsRun={endsRun}
										officerName={session.officer_name}
										officerAvatar={session.officer_avatar}
										borrowerName={session.entity?.name || "You"}
										isEditing={m.message_id === editingId}
										onDelete={() =>
											submitIntent([
												{ type: "delete_message", params: { message_id: m.message_id } },
											])
										}
										onStartEdit={startEdit}
									/>
								</div>
							);
						})}
						{displayedThread.length === 0 && !operatorTyping && (
							<div className="py-4 text-center">
								<p className="text-sm text-slate-400">No messages yet.</p>
								{/* Gated on `inboundAddress`. `null` is the ordinary case — the
								    receiving mail domain is unconfigured in every deployment
								    today — and then this renders NOTHING: no disabled control, no
								    placeholder, and no address composed on the client.
								    "from the address your loan officer has for you" is not
								    hedging: veritas' inbound webhook resolves the sender with
								    `PortalPartyRepo.get_by_case_email` and drops mail from an
								    address the case does not already know (router.py, the
								    `party is None` branch — logged, no row written), so a
								    borrower mailing from some other account gets silence. */}
								{inboundAddress && (
									<p className="mt-2 text-xs text-slate-400">
										Or email them to{" "}
										<a
											href={inboundMailtoHref(inboundAddress)}
											className="break-all font-medium text-blue-700 underline underline-offset-2"
										>
											{inboundAddress}
										</a>{" "}
										from the address your loan officer has for you.
									</p>
								)}
							</div>
						)}
						{operatorTyping && <TypingBubble />}
						{waitingForReply && (
							<p className="text-center text-xs text-slate-400 mt-3">
								Your loan officer will reply here — we'll let you know.
							</p>
						)}
					</div>

					<div className="border-t border-slate-200 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
						{uploading && <p className="mb-1 text-xs text-slate-400">Uploading…</p>}
						{editingId && (
							<div className="flex items-center justify-between text-xs text-blue-700 mb-1">
								<span className="font-medium">Editing message</span>
								<button
									type="button"
									onClick={cancelEdit}
									className="text-slate-500 hover:text-slate-700 cursor-pointer"
								>
									Cancel
								</button>
							</div>
						)}
						<div className="flex items-end gap-2">
							<input
								ref={fileRef}
								type="file"
								multiple
								accept={ACCEPT_ATTR}
								className="hidden"
								onChange={(e) => onFiles(e.target.files)}
							/>
							{/* No attaching while editing an existing message — edit is text-only. */}
							{!editingId && (
								<button
									type="button"
									onClick={() => fileRef.current?.click()}
									disabled={uploading}
									aria-label="Attach documents"
									className="shrink-0 h-10 w-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-50 flex items-center justify-center cursor-pointer"
								>
									<Paperclip size={18} />
								</button>
							)}
							{/* The second way to send a document: the borrower's own case address,
							    beside the picker that is the first. Same `inboundAddress` gate as the
							    empty state above — nothing at all when the server sends `null`.
							    The static `aria-label` is not a secrecy measure, and nothing here
							    keeps the address out of the DOM: it is this element's `href`, and in
							    the empty state above it is the link's text AND its accessible name
							    (`BorrowerPortal.test.tsx` pins `toHaveAccessibleName(ADDRESS)` there),
							    so a screen reader on that screen reads it out — deliberately: the
							    borrower has to be able to hear, read and copy it. What the label buys
							    is only this: the accessible name of THIS icon-only control is the
							    static string, so it announces its purpose rather than spelling the
							    address out every time focus lands on it. The address itself is a
							    capability of the same class as the access code — guard it where it
							    could leave the page, not in the markup the borrower is meant to read. */}
							{!editingId && inboundAddress && (
								<a
									href={inboundMailtoHref(inboundAddress)}
									aria-label="Email your documents"
									className="shrink-0 h-10 w-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
								>
									<Mail size={18} />
								</a>
							)}
							<textarea
								value={replyText}
								onChange={(e) => {
									setReplyText(e.target.value);
									onTyping();
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										sendReply();
									}
								}}
								rows={1}
								placeholder={editingId ? "Edit message…" : "Message…"}
								className="flex-1 resize-none rounded-2xl border border-slate-300 px-3 py-2 text-sm max-h-32"
							/>
							<button
								type="button"
								onClick={sendReply}
								disabled={sendingReply || !replyText.trim()}
								className="shrink-0 h-10 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 cursor-pointer transition-colors"
							>
								{editingId ? "Save" : "Send"}
							</button>
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}

/** The "Your loan officer" label shown once at the start of each officer run —
 * indented to sit above the bubble (which is left-aligned, avatar on the left).
 * The face itself is the {@link Avatar} on the last bubble of the run. */
function OfficerHeader() {
	return (
		<div className="flex items-center gap-2 mb-0.5 pl-9">
			<span className="text-xs font-medium text-slate-500">Your loan officer</span>
		</div>
	);
}

/** A single staggered chat row — avatar + bubble. The sender sits on their own
 * side (borrower right, officer left); the avatar is adjacent to the bubble on
 * the outer edge, shown only on the LAST bubble of a consecutive run (a spacer
 * holds the column otherwise so bubbles stay aligned). Officer runs get the
 * "Your loan officer" header on their first bubble; the borrower's own bubbles
 * get a ✓/✓✓ read receipt and a hover delete (their request/reply messages
 * only — never uploads). */
function Bubble({
	m,
	showOfficerHeader,
	showAvatar,
	endsRun,
	isEditing,
	officerName,
	officerAvatar,
	borrowerName,
	onDelete,
	onStartEdit,
}: {
	m: ThreadMessage;
	showOfficerHeader: boolean;
	showAvatar: boolean;
	/** Last bubble of a consecutive same-author run — gets the WhatsApp tail
	 * corner (`rounded-br-md`/`rounded-bl-md`). Mid-run bubbles stay fully round. */
	endsRun: boolean;
	/** This bubble's message is loaded in the reply composer for editing —
	 * highlight it so the borrower sees what they're editing. */
	isEditing: boolean;
	officerName: string;
	officerAvatar: string;
	borrowerName: string;
	onDelete: () => void;
	/** Pencil click → load this message into the bottom reply composer. */
	onStartEdit: (m: ThreadMessage) => void;
}) {
	const mine = m.author_kind === "borrower";
	const items = (m.items ?? []) as Array<{ title?: string }>;
	const align = mine ? "items-end" : "items-start";
	const deleted = m.deleted === true;
	// The borrower can modify only their OWN non-upload, non-deleted messages
	// (uploads are case events with no row; deleted messages are tombstones).
	const canModify = mine && m.kind !== "upload" && !deleted;

	// WhatsApp bubble shape: fully rounded mid-run; the last bubble of a run gets
	// a small tail corner on the speaker's inner-bottom edge (own → bottom-right,
	// incoming → bottom-left).
	const tail = endsRun ? (mine ? "rounded-br-md" : "rounded-bl-md") : "";
	const bubbleShape = `rounded-2xl ${tail} shadow-sm`;

	// In-bubble meta row (WhatsApp): time + "· edited" + ✓/✓✓ receipt, tucked
	// bottom-right INSIDE the bubble. Muted against the bubble background.
	const meta = !deleted && (
		<span
			className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] leading-none ${mine ? "text-blue-200" : "text-slate-400"}`}
		>
			{clockTime(m.created_at)}
			{m.edited && <span>· edited</span>}
			{mine && (m.read ? <CheckCheck size={12} /> : <Check size={12} />)}
		</span>
	);

	// Avatar column (40px, matching the operator side): the face on the last
	// bubble of a run, a spacer otherwise so consecutive bubbles in the run stay
	// aligned.
	const avatar = showAvatar ? (
		<Avatar
			size={40}
			name={mine ? borrowerName : officerName || "Loan officer"}
			photoUrl={mine ? null : officerAvatar}
			title={mine ? borrowerName : officerName || "Your loan officer"}
		/>
	) : (
		<span className="shrink-0" style={{ width: 40 }} />
	);

	const inner = deleted ? (
		<div className={`inline-flex items-center gap-1.5 max-w-[75%] ${bubbleShape} px-3 py-2 text-sm italic text-slate-400 ${mine ? "bg-slate-100" : "bg-white border border-slate-200"}`}>
			<Ban size={13} className="shrink-0" /> This message was deleted
		</div>
	) : m.kind === "upload" ? (
		m.processing ? (
			// Still being extracted — muted "Processing…" placeholder (the borrower
			// has no doc viewer, so uploads are never clickable here).
			<div className={`flex items-center gap-2 max-w-[75%] ${bubbleShape} px-3 py-2 text-sm bg-slate-100 text-slate-400`}>
				<Loader2 size={14} className="shrink-0 animate-spin" />
				<span className="min-w-0 break-all">{m.body}</span>
				<span className="shrink-0 italic">· Processing…</span>
			</div>
		) : (
			<div className={`flex items-center gap-2 max-w-[75%] ${bubbleShape} px-3 py-2 text-sm ${mine ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}>
				<FileText size={14} className="shrink-0" />
				<span className="min-w-0 break-all">{m.body}</span>
				<Check size={13} className={`shrink-0 ${mine ? "text-blue-200" : "text-green-500"}`} />
			</div>
		)
	) : (
		<div className={`max-w-[75%] ${bubbleShape} px-3 py-2 text-sm ${mine ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-800"}`}>
			{m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
			{items.length > 0 && (
				<ul className={`mt-1 ml-4 list-disc ${mine ? "text-blue-100" : "text-slate-600"}`}>
					{items.map((it, i) => <li key={i}>{it.title}</li>)}
				</ul>
			)}
			{meta}
		</div>
	);

	return (
		<div className={`group flex flex-col w-full ${align} ${isEditing ? "rounded-xl ring-2 ring-blue-300" : ""}`}>
			{!mine && showOfficerHeader && <OfficerHeader />}
			{/* Row reads inward from the speaker's side: [avatar][edit][delete][bubble]
			    for the officer (left), mirrored for the borrower (right). */}
			<div className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}>
				{avatar}
				<div className={`flex items-center gap-1.5 ${mine ? "flex-row" : "flex-row-reverse"}`}>
					{/* Edit + delete show ONLY on the borrower's own non-deleted, non-upload
					    bubbles. The pencil loads this message into the bottom composer. */}
					{canModify && (
						<div className={`flex items-center gap-0.5 ${mine ? "flex-row" : "flex-row-reverse"}`}>
							<button
								type="button"
								onClick={() => onStartEdit(m)}
								aria-label="Edit message"
								className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-blue-700 p-1"
							>
								<Pencil size={13} />
							</button>
							<button
								type="button"
								onClick={onDelete}
								aria-label="Delete message"
								className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500 p-1"
							>
								<Trash2 size={13} />
							</button>
						</div>
					)}
					{inner}
				</div>
			</div>
		</div>
	);
}

/** Animated "officer is typing" bubble. */
function TypingBubble() {
	return (
		<div className="flex justify-start">
			<div className="bg-white border border-slate-200 rounded-2xl px-3 py-2 flex gap-1">
				<span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
				<span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
				<span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
			</div>
		</div>
	);
}

function mergeThread(...chunks: ThreadMessage[][]): ThreadMessage[] {
	const seen = new Set<string>();
	const out: ThreadMessage[] = [];
	for (const item of chunks.flat()) {
		if (seen.has(item.message_id)) continue;
		seen.add(item.message_id);
		out.push(item);
	}
	return out.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

function CodeStep({
	n,
	verified,
	onVerify,
}: {
	n: number;
	verified: boolean;
	onVerify: (code: string) => Promise<unknown>;
}) {
	const [code, setCode] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [failed, setFailed] = useState(false);

	async function submit() {
		setSubmitting(true);
		setFailed(false);
		await onVerify(code.trim());
		setSubmitting(false);
		if (!verified) setFailed(true);
	}

	return (
		<section>
			<StepHeading n={n} title="Enter your access code" />
			<div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
				<p className="text-sm text-slate-600">
					Your loan officer sent you a code along with this link. Enter it below to securely
					access your application.
				</p>
				<input
					type="text"
					inputMode="numeric"
					maxLength={5}
					value={code}
					onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
					onKeyDown={(e) => { if (e.key === "Enter" && code.length >= 4) submit(); }}
					placeholder="• • • • •"
					autoComplete="one-time-code"
					className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-2xl tracking-[0.5em] font-mono"
				/>
				{failed && (
					<p className="text-sm text-red-600" role="alert">
						That code didn't match. Check the code your loan officer sent you.
					</p>
				)}
				<button
					type="button"
					onClick={submit}
					disabled={submitting || code.length < 4}
					className="w-full rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-3"
				>
					{submitting ? "Checking…" : "Continue"}
				</button>
				<p className="text-xs text-slate-400 flex items-center gap-1">
					<Lock size={12} /> Don't have a code? Ask your loan officer.
				</p>
			</div>
		</section>
	);
}

/** E-signature + consent step — type full name to consent and e-sign. */
function SignStep({ n, name, onSign }: { n: number; name: string; onSign: (signature: string) => Promise<unknown> }) {
	const [signature, setSignature] = useState("");
	const [agreed, setAgreed] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	async function submit() {
		setSubmitting(true);
		await onSign(signature.trim());
		setSubmitting(false);
	}

	return (
		<section>
			<StepHeading n={n} title="Consent & e-signature" />
			<div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
				<p className="text-sm text-slate-600">
					To share documents electronically, please consent and sign below. You can revoke this
					by contacting your loan officer.
				</p>
				<label className="flex gap-3 text-sm text-slate-700">
					<input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
					<span>
						I agree to electronically process and share the documents I provide, and I consent to
						electronic records and signatures.
					</span>
				</label>
				<div>
					<label className="block text-sm font-medium text-slate-700 mb-1">Type your full legal name to sign</label>
					<input
						type="text"
						value={signature}
						onChange={(e) => setSignature(e.target.value)}
						placeholder={name}
						className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-serif italic"
					/>
				</div>
				<button
					type="button"
					onClick={submit}
					disabled={submitting || !agreed || signature.trim().length === 0}
					className="w-full rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-3"
				>
					{submitting ? "Signing…" : "Agree & e-sign"}
				</button>
			</div>
		</section>
	);
}

/** Account step — capture an email so the borrower can return.
 *
 * What happens next depends entirely on whether the host gave us
 * `hasAccountHook`. The email is ALWAYS stored server-side via `onSubmit`
 * (the `set_email` intent), regardless — but only a host that also supplies
 * `onCreateAccount` (e.g. gunnr, with a Firebase-backed signed-in user) can
 * actually mail a sign-in link. POS supplies no such hook, because a POS
 * applicant is a stranger with no session — inventing a credential for them
 * would be a lie.
 *
 * - `hasAccountHook: true` — submitting only SENDS the sign-in link; it does
 *   not claim the account. So on submit we switch to a local waiting state
 *   ("Check your email") and do NOT advance — advancing is driven solely by
 *   `session.has_account` flipping true once the borrower clicks the link and
 *   returns signed-in (which runs claim-account), or by Skip. The portal
 *   silently refetches the session, so the step moves on on its own once the
 *   account is claimed.
 * - `hasAccountHook: false` — there is no link to wait for. The email is
 *   already stored the moment `onSubmit` resolves, so the step completes
 *   immediately (`onSubmitWithoutHook`) rather than parking on a wait that can
 *   never end. No "check your inbox" claim, spam hint, or Resend control is
 *   ever shown on this path — nothing was sent. */
function AccountStep({
	n,
	onSubmit,
	onSkip,
	onSubmitWithoutHook,
	hasAccountHook,
	returning = false,
	initialEmail = "",
}: {
	n: number;
	onSubmit: (email: string) => Promise<void>;
	onSkip: () => void;
	/** Called once `onSubmit` resolves when there is no account-creation hook —
	 * there is nothing left to wait for, so this advances the step. */
	onSubmitWithoutHook: () => void;
	/** Whether the host supplied `onCreateAccount`. Only then can a sign-in
	 * link actually be sent — everything about the sent-state UI is gated on
	 * this so the copy never claims an email went out that didn't. */
	hasAccountHook: boolean;
	/** They've been here before (an email is already on file) — sign-in framing. */
	returning?: boolean;
	initialEmail?: string;
}) {
	const [email, setEmail] = useState(initialEmail);
	const [submitting, setSubmitting] = useState(false);
	const [sent, setSent] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const valid = email.includes("@") && email.includes(".");
	const title = !hasAccountHook
		? returning
			? "Your email"
			: "Add your email"
		: returning
			? "Use your email to continue"
			: "Create your account";

	async function submit() {
		if (!valid) return;
		setError(null);
		setSubmitting(true);
		try {
			await onSubmit(email.trim());
			if (hasAccountHook) {
				setSent(true);
			} else {
				// Nothing to wait for: the email is already stored. Advance rather
				// than park on a "check your inbox" state that would never resolve.
				onSubmitWithoutHook();
			}
		} catch (e) {
			// Surface the real reason (Firebase rate-limit / quota / domain) instead
			// of leaving the button stuck on "Sending…".
			setError(e instanceof Error ? e.message : "Couldn't send the email. Please try again.");
		} finally {
			setSubmitting(false);
		}
	}

	if (sent) {
		return (
			<section>
				<StepHeading n={n} title={title} />
				<div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-center">
					<div className="mx-auto h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center">
						<Mail size={22} className="text-indigo-600" />
					</div>
					<div>
						<h3 className="font-semibold text-slate-800">Email sent — check your inbox</h3>
						<p className="text-sm text-slate-600 mt-1">
							We sent a secure sign-in link to <span className="font-medium text-slate-800">{email.trim()}</span>.
							Open it to continue — this page moves on automatically once you're signed in.
						</p>
					</div>
					<p className="text-xs text-amber-600">
						Don't see it? Check your spam or junk folder — it can take a minute to arrive.
					</p>
					<button
						type="button"
						onClick={submit}
						disabled={submitting}
						className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
					>
						{submitting ? "Resending…" : "Resend email"}
					</button>
					<button
						type="button"
						onClick={() => { setSent(false); setError(null); }}
						className="block w-full text-center text-xs text-slate-500 hover:text-slate-700"
					>
						Use a different email
					</button>
					<button
						type="button"
						onClick={onSkip}
						className="w-full rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium py-2.5"
					>
						Skip for now — you can create an account later
					</button>
				</div>
			</section>
		);
	}

	return (
		<section>
			<StepHeading n={n} title={title} />
			<div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
				<p className="text-sm text-slate-600">
					{hasAccountHook
						? returning
							? "Use your email to continue your application — we'll send you a secure sign-in link."
							: "Add your email so you can come back to your application anytime — we'll send you a secure sign-in link."
						: "We'll remember your email so you can pick up where you left off."}
				</p>
				<input
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					onKeyDown={(e) => { if (e.key === "Enter" && valid) submit(); }}
					placeholder="you@example.com"
					autoComplete="email"
					className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
				/>
				{error && <p className="text-sm text-red-600" role="alert">{error}</p>}
				<button
					type="button"
					onClick={submit}
					disabled={submitting || !valid}
					className="w-full rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-3"
				>
					{submitting ? "Sending…" : "Continue"}
				</button>
				<button
					type="button"
					onClick={onSkip}
					className="w-full rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium py-2.5"
				>
					Skip for now — you can create an account later
				</button>
			</div>
		</section>
	);
}

/** Labels come from the caller: the flow is assembled per session, so this
 * cannot own a fixed list. */
function Stepper({ steps, current }: { steps: string[]; current: number }) {
	return (
		<ol className="flex items-center gap-2 mb-6">
			{steps.map((label, i) => {
				const n = i + 1;
				const state = n < current ? "done" : n === current ? "active" : "todo";
				return (
					<li key={label} className="flex items-center gap-2 flex-1">
						<span
							className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
								state === "done"
									? "bg-green-600 text-white"
									: state === "active"
										? "bg-indigo-600 text-white"
										: "bg-slate-200 text-slate-500"
							}`}
						>
							{state === "done" ? "✓" : n}
						</span>
						<span className={`text-xs ${state === "active" ? "text-slate-900 font-medium" : "text-slate-400"}`}>
							{label}
						</span>
						{n < steps.length && <span className="flex-1 h-px bg-slate-200" />}
					</li>
				);
			})}
		</ol>
	);
}

function StepHeading({ n, title }: { n: number; title: string }) {
	return <h2 className="font-semibold text-slate-800 mb-3">Step {n}: {title}</h2>;
}

function wrap(className?: string): string {
	return `max-w-2xl mx-auto p-6${className ? ` ${className}` : ""}`;
}
